import type { DataSource } from 'typeorm';

export interface DoubtRecord {
  id: string;
  studentId: string;
  attemptId: string;
  questionId: string;
  message: string | null;
  hintsUsed: number;
  status: 'AI_HINTS' | 'WAITING_TEACHER' | 'ANSWERED';
  teacherRequestedAt: Date | null;
  teacherAnswer: string | null;
  answeredAt: Date | null;
  aiHelpful: boolean | null;
  teacherHelpful: boolean | null;
}

export interface StoredHint {
  level: number;
  text: string;
  source: 'llm' | 'reference';
}

interface Row {
  id: string;
  student_id: string;
  attempt_id: string;
  question_id: string;
  message: string | null;
  hints_used: number;
  status: DoubtRecord['status'];
  teacher_requested_at: Date | null;
  teacher_answer: string | null;
  answered_at: Date | null;
  ai_helpful: boolean | null;
  teacher_helpful: boolean | null;
}

const toRecord = (r: Row): DoubtRecord => ({
  id: r.id,
  studentId: r.student_id,
  attemptId: r.attempt_id,
  questionId: r.question_id,
  message: r.message,
  hintsUsed: r.hints_used,
  status: r.status,
  teacherRequestedAt: r.teacher_requested_at,
  teacherAnswer: r.teacher_answer,
  answeredAt: r.answered_at,
  aiHelpful: r.ai_helpful,
  teacherHelpful: r.teacher_helpful,
});

const COLUMNS =
  'id, student_id, attempt_id, question_id, message, hints_used, status, teacher_requested_at, teacher_answer, answered_at, ai_helpful, teacher_helpful';

export interface TeacherRow {
  id: string;
  status: 'WAITING_TEACHER' | 'ANSWERED';
  message: string | null;
  hints_used: number;
  misconception: string | null;
  teacher_requested_at: Date;
  answered_at: Date | null;
  teacher_answer: string | null;
  student_name: string;
  topic: string;
  statement: string;
  options: { key: string; text: string }[];
  correct_option: string;
  reference_explanation: string;
  selected_option: string;
}

export class DoubtRepository {
  constructor(private readonly ds: DataSource) {}

  /** Existing doubt for this question of this attempt, or a new one (safe under concurrent taps). */
  async openOrGet(input: {
    studentId: string;
    attemptId: string;
    questionId: string;
    message: string | null;
  }): Promise<{ doubt: DoubtRecord; created: boolean }> {
    const inserted = await this.ds.query<Row[]>(
      `INSERT INTO doubts (student_id, attempt_id, question_id, message)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (attempt_id, question_id) DO NOTHING
       RETURNING ${COLUMNS}`,
      [input.studentId, input.attemptId, input.questionId, input.message],
    );
    if (inserted[0]) return { doubt: toRecord(inserted[0]), created: true };
    // The note can still be added or changed until the first hint is given (the hints depend on it).
    if (input.message !== null) {
      await this.ds.query(
        `UPDATE doubts SET message = $1
         WHERE attempt_id = $2 AND question_id = $3 AND student_id = $4 AND hints_used = 0`,
        [input.message, input.attemptId, input.questionId, input.studentId],
      );
    }
    const rows = await this.ds.query<Row[]>(
      `SELECT ${COLUMNS} FROM doubts WHERE attempt_id = $1 AND question_id = $2`,
      [input.attemptId, input.questionId],
    );
    return { doubt: toRecord(rows[0] as Row), created: false };
  }

  /** Only the owner can read a doubt: someone else's id looks like it does not exist. */
  async findOwned(doubtId: string, studentId: string): Promise<DoubtRecord | null> {
    const rows = await this.ds.query<Row[]>(
      `SELECT ${COLUMNS} FROM doubts WHERE id = $1 AND student_id = $2`,
      [doubtId, studentId],
    );
    return rows[0] ? toRecord(rows[0]) : null;
  }

  /**
   * Atomically takes the next hint level. Two taps at once get two different levels, and the
   * level can never pass the maximum, so the full solution cannot be reached out of order.
   */
  async claimNextLevel(doubtId: string, studentId: string, max: number): Promise<number | null> {
    // TypeORM returns `[rows, affectedCount]` for UPDATE ... RETURNING on Postgres (unlike INSERT).
    const result = await this.ds.query<[{ hints_used: number }[], number]>(
      `UPDATE doubts SET hints_used = hints_used + 1
       WHERE id = $1 AND student_id = $2 AND hints_used < $3
       RETURNING hints_used`,
      [doubtId, studentId, max],
    );
    return result[0][0]?.hints_used ?? null;
  }

  async saveHint(doubtId: string, hint: StoredHint): Promise<void> {
    await this.ds.query(
      `INSERT INTO doubt_hints (doubt_id, level, text, source) VALUES ($1, $2, $3, $4)
       ON CONFLICT (doubt_id, level) DO NOTHING`,
      [doubtId, hint.level, hint.text, hint.source],
    );
  }

  async listHints(doubtId: string): Promise<StoredHint[]> {
    return this.ds.query<StoredHint[]>(
      `SELECT level, text, source FROM doubt_hints WHERE doubt_id = $1 ORDER BY level`,
      [doubtId],
    );
  }

  /** AI_HINTS -> WAITING_TEACHER once; asking again changes nothing (the original time is kept). */
  async requestTeacher(doubtId: string, studentId: string): Promise<void> {
    await this.ds.query(
      `UPDATE doubts SET status = 'WAITING_TEACHER', teacher_requested_at = now()
       WHERE id = $1 AND student_id = $2 AND status = 'AI_HINTS'`,
      [doubtId, studentId],
    );
  }

  async saveFeedback(
    doubtId: string,
    studentId: string,
    feedback: { aiHelpful?: boolean; teacherHelpful?: boolean },
  ): Promise<void> {
    await this.ds.query(
      `UPDATE doubts
       SET ai_helpful = COALESCE($3, ai_helpful), teacher_helpful = COALESCE($4, teacher_helpful)
       WHERE id = $1 AND student_id = $2`,
      [doubtId, studentId, feedback.aiHelpful ?? null, feedback.teacherHelpful ?? null],
    );
  }

  /**
   * A teacher answers a waiting doubt. The status check inside the UPDATE makes it safe when two
   * teachers answer at once: exactly one wins, the other gets false.
   */
  async answer(doubtId: string, teacherId: string, text: string): Promise<boolean> {
    const result = await this.ds.query<[{ id: string }[], number]>(
      `UPDATE doubts
       SET status = 'ANSWERED', teacher_answer = $3, answered_at = now(), answered_by = $2
       WHERE id = $1 AND status = 'WAITING_TEACHER'
       RETURNING id`,
      [doubtId, teacherId, text],
    );
    return result[0].length > 0;
  }

  /** Waiting doubts oldest first, or the answers this teacher gave most recently. */
  async teacherList(status: 'waiting' | 'answered', teacherId: string): Promise<TeacherRow[]> {
    const waiting = status === 'waiting';
    const rows = await this.ds.query<TeacherRow[]>(
      `SELECT d.id, d.status, d.message, d.hints_used, d.misconception, d.teacher_requested_at,
              d.answered_at, d.teacher_answer, st.name AS student_name, t.name AS topic,
              q.statement, q.options, q.correct_option, q.reference_explanation,
              aa.selected_option
       FROM doubts d
       JOIN students st ON st.id = d.student_id
       JOIN questions q ON q.id = d.question_id
       JOIN topics t ON t.id = q.topic_id
       JOIN attempt_answers aa ON aa.attempt_id = d.attempt_id AND aa.question_id = d.question_id
       WHERE d.status = $1 AND ($1 = 'WAITING_TEACHER' OR d.answered_by = $2)
       ORDER BY ${waiting ? 'd.teacher_requested_at ASC' : 'd.answered_at DESC'}
       LIMIT 50`,
      [waiting ? 'WAITING_TEACHER' : 'ANSWERED', teacherId],
    );
    return rows;
  }

  async hintsFor(doubtIds: string[]): Promise<Map<string, StoredHint[]>> {
    const byDoubt = new Map<string, StoredHint[]>();
    if (doubtIds.length === 0) return byDoubt;
    const rows = await this.ds.query<(StoredHint & { doubt_id: string })[]>(
      `SELECT doubt_id, level, text, source FROM doubt_hints
       WHERE doubt_id = ANY($1::uuid[]) ORDER BY level`,
      [doubtIds],
    );
    for (const r of rows) {
      const list = byDoubt.get(r.doubt_id) ?? [];
      list.push({ level: r.level, text: r.text, source: r.source });
      byDoubt.set(r.doubt_id, list);
    }
    return byDoubt;
  }
}
