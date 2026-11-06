import type { DataSource } from 'typeorm';

export interface DoubtRecord {
  id: string;
  studentId: string;
  attemptId: string;
  questionId: string;
  message: string | null;
  hintsUsed: number;
  status: 'AI_HINTS' | 'WAITING_TEACHER' | 'ANSWERED';
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
}

const toRecord = (r: Row): DoubtRecord => ({
  id: r.id,
  studentId: r.student_id,
  attemptId: r.attempt_id,
  questionId: r.question_id,
  message: r.message,
  hintsUsed: r.hints_used,
  status: r.status,
});

const COLUMNS = 'id, student_id, attempt_id, question_id, message, hints_used, status';

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
}
