import { notFound } from '../../shared/errors/app-error.js';
import { assertDemoStudent } from '../../shared/errors/guards.js';
import {
  RECENT_ATTEMPTS_WINDOW,
  buildProgress,
  latestAnswerPerQuestion,
  overallStatus,
  selectReviewTopics,
  selectSuggestions,
} from './domain.js';
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
    assertDemoStudent(studentId, this.demoStudentId);
    if (!(await this.repo.studentExists(studentId))) {
      throw notFound('STUDENT_NOT_FOUND', 'Aluno não encontrado');
    }

    const history = await this.repo.history(studentId);
    // Priority uses the CURRENT state (latest answer per question, any quiz). Progress shows the
    // trajectory of the last full quizzes only: review quizzes have a different size and scope.
    const current = latestAnswerPerQuestion(
      history.answers,
      history.attempts.map((a) => a.id),
    );
    const review = selectReviewTopics(current);
    const candidates = await this.repo.unansweredQuestions(
      studentId,
      review.map((t) => t.topicId),
    );

    return {
      studentId,
      status: overallStatus(history.attempts.length, review.length),
      evaluatedAttempts: history.attempts.length,
      progress: buildProgress(
        history.answers,
        history.attempts.filter((a) => a.kind === 'standard').slice(0, RECENT_ATTEMPTS_WINDOW),
      ).map((p) => ({
        ...p,
        submittedAt: p.submittedAt.toISOString(),
      })),
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
