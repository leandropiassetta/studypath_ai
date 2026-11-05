import type { DataSource } from 'typeorm';
import {
  Quiz,
  QuizQuestion,
  type Difficulty,
  type QuestionOption,
} from '../../database/entities/index.js';
import type { QuizView } from './schemas.js';

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
