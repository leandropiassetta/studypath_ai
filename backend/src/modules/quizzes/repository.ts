import type { DataSource } from 'typeorm';
import {
  Quiz,
  QuizQuestion,
  type Difficulty,
  type QuestionOption,
} from '../../database/entities/index.js';
import type { QuizListItem, QuizView } from './schemas.js';

interface QuestionRow {
  id: string;
  statement: string;
  options: QuestionOption[];
  difficulty: Difficulty;
  topic_id: string;
  topic_name: string;
}

export class QuizRepository {
  constructor(private readonly ds: DataSource) {}

  /** The simulados a student can choose from (review quizzes are made on demand, not listed). */
  async listStandard(): Promise<QuizListItem[]> {
    const rows = await this.ds.query<
      {
        id: string;
        slug: string;
        title: string;
        question_count: number;
        topics: { id: string; name: string }[];
      }[]
    >(
      `SELECT qz.id, qz.slug, qz.title,
              count(qq.question_id)::int AS question_count,
              COALESCE(json_agg(DISTINCT jsonb_build_object('id', t.id, 'name', t.name))
                       FILTER (WHERE t.id IS NOT NULL), '[]') AS topics
       FROM quizzes qz
       LEFT JOIN quiz_questions qq ON qq.quiz_id = qz.id
       LEFT JOIN questions q ON q.id = qq.question_id
       LEFT JOIN topics t ON t.id = q.topic_id
       WHERE qz.is_active AND qz.kind = 'standard'
       GROUP BY qz.id
       HAVING count(qq.question_id) > 0
       ORDER BY qz.title`,
    );
    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      questionCount: r.question_count,
      topics: [...r.topics].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    }));
  }

  /** Active quiz with questions ordered by position. Never selects the answer key. */
  async findActiveBySlug(slug: string): Promise<QuizView | null> {
    const quiz = await this.ds.getRepository(Quiz).findOneBy({ slug, isActive: true });
    if (!quiz) return null;

    const rows = await this.ds
      .getRepository(QuizQuestion)
      .createQueryBuilder('qq')
      .innerJoin('qq.question', 'q')
      .innerJoin('q.topic', 't')
      .select('q.id', 'id')
      .addSelect('q.statement', 'statement')
      .addSelect('q.options', 'options')
      .addSelect('q.difficulty', 'difficulty')
      .addSelect('t.id', 'topic_id')
      .addSelect('t.name', 'topic_name')
      .where('qq.quizId = :quizId', { quizId: quiz.id })
      .orderBy('qq.position', 'ASC')
      .getRawMany<QuestionRow>();

    return {
      id: quiz.id,
      slug: quiz.slug,
      title: quiz.title,
      kind: quiz.kind,
      questions: rows.map((r) => ({
        id: r.id,
        topic: { id: r.topic_id, name: r.topic_name },
        statement: r.statement,
        options: r.options,
        difficulty: r.difficulty,
      })),
    };
  }
}
