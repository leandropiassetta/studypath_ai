import { notFound } from '../../shared/errors/app-error.js';
import type { QuizRepository } from './repository.js';
import type { QuizView } from './schemas.js';

export class QuizService {
  constructor(private readonly quizzes: QuizRepository) {}

  async getBySlug(slug: string): Promise<QuizView> {
    const quiz = await this.quizzes.findActiveBySlug(slug);
    if (!quiz) throw notFound('QUIZ_NOT_FOUND', 'Simulado não encontrado');
    return quiz;
  }
}
