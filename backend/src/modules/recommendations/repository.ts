import type { DataSource } from 'typeorm';
import type { QuestionOption } from '../../database/entities/index.js';
import { type AttemptSummary, type Difficulty, type HistoricAnswer } from './domain.js';

const MAX_HISTORY_ATTEMPTS = 500;

export interface UnansweredQuestion {
  id: string;
  topicId: string;
  statement: string;
  options: QuestionOption[];
  difficulty: Difficulty;
  createdAt: Date;
}

export class RecommendationRepository {
  constructor(private readonly ds: DataSource) {}

  /**
   * RN-06: the student's attempts (newest first, capped) and all their answers. The cap only
   * bounds the work for very long histories; the demo never gets near it.
   */
  async history(studentId: string): Promise<{
    attempts: AttemptSummary[];
    answers: HistoricAnswer[];
  }> {
    const attempts = await this.ds.query<
      {
        id: string;
        submitted_at: Date;
        score_pct: string;
        kind: 'standard' | 'review';
        quiz_id: string;
      }[]
    >(
      `SELECT a.id, a.submitted_at, a.score_pct, qz.kind, a.quiz_id
       FROM attempts a JOIN quizzes qz ON qz.id = a.quiz_id
       WHERE a.student_id = $1
       ORDER BY a.submitted_at DESC, a.id DESC LIMIT $2`,
      [studentId, MAX_HISTORY_ATTEMPTS],
    );
    if (attempts.length === 0) return { attempts: [], answers: [] };

    const rows = await this.ds.query<
      {
        attempt_id: string;
        question_id: string;
        topic_id: string;
        topic_name: string;
        is_correct: boolean;
      }[]
    >(
      `SELECT aa.attempt_id, aa.question_id, t.id AS topic_id, t.name AS topic_name, aa.is_correct
       FROM attempt_answers aa
       JOIN questions q ON q.id = aa.question_id
       JOIN topics t ON t.id = q.topic_id
       WHERE aa.attempt_id = ANY($1::uuid[])`,
      [attempts.map((a) => a.id)],
    );
    return {
      attempts: attempts.map((a) => ({
        id: a.id,
        submittedAt: a.submitted_at,
        scorePct: Number(a.score_pct),
        kind: a.kind,
        quizId: a.quiz_id,
      })),
      answers: rows.map((r) => ({
        attemptId: r.attempt_id,
        questionId: r.question_id,
        topicId: r.topic_id,
        topicName: r.topic_name,
        isCorrect: r.is_correct,
      })),
    };
  }

  /** RN-08: questions of the topics the student has never answered in ANY attempt/quiz. */
  async unansweredQuestions(studentId: string, topicIds: string[]): Promise<UnansweredQuestion[]> {
    if (topicIds.length === 0) return [];
    const rows = await this.ds.query<
      {
        id: string;
        topic_id: string;
        statement: string;
        options: QuestionOption[];
        difficulty: Difficulty;
        created_at: Date;
      }[]
    >(
      `SELECT q.id, q.topic_id, q.statement, q.options, q.difficulty, q.created_at
       FROM questions q
       WHERE q.topic_id = ANY($1::uuid[])
         AND NOT EXISTS (
           SELECT 1 FROM attempt_answers aa
           JOIN attempts a ON a.id = aa.attempt_id
           WHERE a.student_id = $2 AND aa.question_id = q.id
         )`,
      [topicIds, studentId],
    );
    return rows.map((r) => ({
      id: r.id,
      topicId: r.topic_id,
      statement: r.statement,
      options: r.options,
      difficulty: r.difficulty,
      createdAt: r.created_at,
    }));
  }
}
