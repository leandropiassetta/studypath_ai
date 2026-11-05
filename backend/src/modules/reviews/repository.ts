import type { DataSource } from 'typeorm';
import type { CandidateQuestion, Difficulty } from '../recommendations/domain.js';

export class ReviewRepository {
  constructor(private readonly ds: DataSource) {}

  async findTopic(id: string): Promise<{ id: string; name: string } | null> {
    const rows = await this.ds.query<{ id: string; name: string }[]>(
      'SELECT id, name FROM topics WHERE id = $1',
      [id],
    );
    return rows[0] ?? null;
  }

  async questionsById(ids: string[]): Promise<CandidateQuestion[]> {
    if (ids.length === 0) return [];
    const rows = await this.ds.query<{ id: string; difficulty: Difficulty; created_at: Date }[]>(
      'SELECT id, difficulty, created_at FROM questions WHERE id = ANY($1::uuid[])',
      [ids],
    );
    return rows.map((r) => ({ id: r.id, difficulty: r.difficulty, createdAt: r.created_at }));
  }

  /**
   * Creates the review quiz, or leaves the existing one untouched when the slug already exists
   * (also under concurrent requests: the unique slug decides, in one transaction).
   */
  async ensureReviewQuiz(slug: string, title: string, questionIds: string[]): Promise<void> {
    await this.ds.transaction(async (m) => {
      const inserted = await m.query<{ id: string }[]>(
        `INSERT INTO quizzes (slug, title, is_active, kind)
         VALUES ($1, $2, true, 'review')
         ON CONFLICT (slug) DO NOTHING
         RETURNING id`,
        [slug, title],
      );
      const quizId = inserted[0]?.id;
      if (quizId === undefined) return; // already created by an earlier or concurrent request
      for (const [index, questionId] of questionIds.entries()) {
        await m.query(
          'INSERT INTO quiz_questions (quiz_id, question_id, position) VALUES ($1, $2, $3)',
          [quizId, questionId, index + 1],
        );
      }
    });
  }
}
