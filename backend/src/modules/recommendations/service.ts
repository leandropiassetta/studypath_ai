import { AppError, notFound } from '../../shared/errors/app-error.js';
import { overallStatus, selectReviewTopics, selectSuggestions } from './domain.js';
import type { RecommendationRepository } from './repository.js';
import type { RecommendationsView } from './schemas.js';

const NO_NEW_QUESTIONS_MESSAGE =
  'Não há exercícios novos para este assunto. Revise as questões já respondidas e as explicações.';

export class RecommendationService {
  constructor(
    private readonly repo: RecommendationRepository,
    private readonly demoStudentId: string,
  ) {}

  async getFor(studentId: string): Promise<RecommendationsView> {
    if (studentId !== this.demoStudentId) {
      throw new AppError(403, 'FORBIDDEN', 'Estudante não autorizado');
    }
    if (!(await this.repo.studentExists(studentId))) {
      throw notFound('STUDENT_NOT_FOUND', 'Aluno não encontrado');
    }

    const history = await this.repo.recentHistory(studentId);
    const review = selectReviewTopics(history.facts);
    const candidates = await this.repo.unansweredQuestions(
      studentId,
      review.map((t) => t.topicId),
    );

    return {
      studentId,
      status: overallStatus(history.attempts, review.length),
      evaluatedAttempts: history.attempts,
      topics: review.map((t) => {
        const suggested = selectSuggestions(candidates.filter((c) => c.topicId === t.topicId));
        const available = suggested.length > 0;
        return {
          ...t,
          priority: t.priority,
          status: available ? ('AVAILABLE' as const) : ('NO_NEW_QUESTIONS' as const),
          ...(available ? {} : { message: NO_NEW_QUESTIONS_MESSAGE }),
          suggestedQuestions: suggested.map((q) => ({
            id: q.id,
            statement: q.statement,
            options: q.options,
            difficulty: q.difficulty,
          })),
        };
      }),
    };
  }
}
