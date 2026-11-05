import type { DataSource } from 'typeorm';
import { Attempt, AttemptAnswer, Quiz, Student } from '../../database/entities/index.js';
import type { GradedAttempt, QuestionKey, SubmittedAnswer } from './domain.js';

interface KeyRow {
  id: string;
  topic_id: string;
  topic_name: string;
  options: { key: string }[];
  correct_option: string;
  reference_explanation: string;
}

export interface NewAttempt {
  studentId: string;
  quizId: string;
  requestId: string;
  payloadHash: string;
  graded: GradedAttempt;
}

export interface StoredAttempt {
  id: string;
  quizId: string;
  payloadHash: string;
}

/** Thrown when (student_id, request_id) already exists: a concurrent or repeated submission. */
export class DuplicateRequestError extends Error {
  constructor() {
    super('duplicate request');
    this.name = 'DuplicateRequestError';
  }
}

const isDuplicateRequest = (err: unknown): boolean => {
  const driver = (err as { driverError?: { code?: string; constraint?: string } }).driverError;
  return driver?.code === '23505' && driver.constraint === 'uq_attempts_student_request';
};

export class AttemptRepository {
  constructor(private readonly ds: DataSource) {}

  studentExists(id: string): Promise<boolean> {
    return this.ds.getRepository(Student).existsBy({ id });
  }

  quizIsActive(id: string): Promise<boolean> {
    return this.ds.getRepository(Quiz).existsBy({ id, isActive: true });
  }

  /** Questions of a quiz in position order, including the answer key (server-side only). */
  async getQuizKeys(quizId: string): Promise<QuestionKey[]> {
    const rows = await this.ds.query<KeyRow[]>(
      `SELECT q.id, q.topic_id, t.name AS topic_name, q.options, q.correct_option,
              q.reference_explanation
       FROM quiz_questions qq
       JOIN questions q ON q.id = qq.question_id
       JOIN topics t ON t.id = q.topic_id
       WHERE qq.quiz_id = $1
       ORDER BY qq.position ASC`,
      [quizId],
    );
    return rows.map((r) => ({
      id: r.id,
      topicId: r.topic_id,
      topicName: r.topic_name,
      optionKeys: r.options.map((o) => o.key),
      correctOption: r.correct_option,
      referenceExplanation: r.reference_explanation,
    }));
  }

  async findByRequest(studentId: string, requestId: string): Promise<StoredAttempt | null> {
    const row = await this.ds.getRepository(Attempt).findOneBy({ studentId, requestId });
    return row ? { id: row.id, quizId: row.quizId, payloadHash: row.payloadHash } : null;
  }

  /** Persisted selections and correctness of an attempt, for replaying the original result. */
  async getStoredAnswers(
    attemptId: string,
  ): Promise<{ answers: SubmittedAnswer[]; correctness: Map<string, boolean> }> {
    const rows = await this.ds.getRepository(AttemptAnswer).findBy({ attemptId });
    return {
      answers: rows.map((r) => ({ questionId: r.questionId, selectedOption: r.selectedOption })),
      correctness: new Map(rows.map((r) => [r.questionId, r.isCorrect])),
    };
  }

  /**
   * RN-04: attempt and answers are written in one transaction; any failure rolls both back.
   * RN-05: a unique violation on (student_id, request_id) becomes DuplicateRequestError.
   */
  async createAttempt(input: NewAttempt): Promise<string> {
    try {
      return await this.insertAttempt(input);
    } catch (err) {
      if (isDuplicateRequest(err)) throw new DuplicateRequestError();
      throw err;
    }
  }

  private insertAttempt(input: NewAttempt): Promise<string> {
    const { graded } = input;
    return this.ds.transaction(async (m) => {
      const inserted = await m.insert(Attempt, {
        studentId: input.studentId,
        quizId: input.quizId,
        requestId: input.requestId,
        payloadHash: input.payloadHash,
        correctCount: graded.correctCount,
        totalCount: graded.totalCount,
        scorePct: graded.scorePct,
      });
      const attemptId = (inserted.identifiers[0] as { id: string }).id;
      await m.insert(
        AttemptAnswer,
        graded.answers.map((a) => ({
          attemptId,
          questionId: a.questionId,
          selectedOption: a.selectedOption,
          isCorrect: a.isCorrect,
        })),
      );
      return attemptId;
    });
  }
}
