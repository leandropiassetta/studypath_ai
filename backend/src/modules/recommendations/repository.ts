import type { DataSource } from 'typeorm';
import type { QuestionOption } from '../../database/entities/index.js';
import { RECENT_ATTEMPTS_WINDOW, type AnswerFact, type Difficulty } from './domain.js';

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

  studentExists(id: string): Promise<boolean> {
    return this.ds
      .query<unknown[]>('SELECT 1 FROM students WHERE id = $1', [id])
      .then((r) => r.length > 0);
  }

  /** RN-06: answers of the student's most recent attempts, from any quiz. */
  async recentHistory(studentId: string): Promise<{ attempts: number; facts: AnswerFact[] }> {
    const attempts = await this.ds.query<{ id: string }[]>(
      `SELECT id FROM attempts WHERE student_id = $1
       ORDER BY submitted_at DESC, id DESC LIMIT $2`,
      [studentId, RECENT_ATTEMPTS_WINDOW],
    );
    if (attempts.length === 0) return { attempts: 0, facts: [] };

    const rows = await this.ds.query<
      { topic_id: string; topic_name: string; is_correct: boolean }[]
    >(
      `SELECT t.id AS topic_id, t.name AS topic_name, aa.is_correct
       FROM attempt_answers aa
       JOIN questions q ON q.id = aa.question_id
       JOIN topics t ON t.id = q.topic_id
       WHERE aa.attempt_id = ANY($1::uuid[])`,
      [attempts.map((a) => a.id)],
    );
    return {
      attempts: attempts.length,
      facts: rows.map((r) => ({
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
