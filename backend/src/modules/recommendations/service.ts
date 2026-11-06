import { notFound } from '../../shared/errors/app-error.js';
import { assertSameStudent } from '../../shared/errors/guards.js';
import {
  RECENT_ATTEMPTS_WINDOW,
  buildProgress,
  progressAttempts,
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
  constructor(private readonly repo: RecommendationRepository) {}

  async getFor(
    authStudentId: string,
    studentId: string,
    quizSlug?: string,
  ): Promise<RecommendationsView> {
    assertSameStudent(studentId, authStudentId);

    const quizzes = await this.repo.standardQuizzes();
    const scope = quizSlug ? quizzes.find((q) => q.slug === quizSlug) : undefined;
    if (quizSlug && !scope) throw notFound('QUIZ_NOT_FOUND', 'Simulado não encontrado');
    const subjectByTopic = new Map(quizzes.flatMap((q) => q.topicIds.map((t) => [t, q.subject])));
    const scopeTopics = scope ? new Set(scope.topicIds) : null;

    const history = await this.repo.history(studentId);
    // With a subject, everything below only looks at that subject's topics and simulado.
    const answers = scopeTopics
      ? history.answers.filter((a) => scopeTopics.has(a.topicId))
      : history.answers;
    const attempts = scopeTopics
      ? history.attempts.filter((at) => answers.some((a) => a.attemptId === at.id))
      : history.attempts;

    // Priority uses the CURRENT state (latest answer per question, any quiz). Progress shows the
    // trajectory of the last full quizzes of ONE simulado: review quizzes have a different size
    // and scope, and scores of different simulados are not comparable.
    const current = latestAnswerPerQuestion(
      answers,
      attempts.map((a) => a.id),
    );
    const review = selectReviewTopics(current);
    const candidates = await this.repo.unansweredQuestions(
      studentId,
      review.map((t) => t.topicId),
    );
    const progress = scope
      ? attempts
          .filter((a) => a.kind === 'standard' && a.quizId === scope.id)
          .slice(0, RECENT_ATTEMPTS_WINDOW)
      : progressAttempts(attempts, RECENT_ATTEMPTS_WINDOW);
    const progressQuiz = scope ?? quizzes.find((q) => q.id === progress[0]?.quizId);

    return {
      studentId,
      status: overallStatus(attempts.length, review.length),
      evaluatedAttempts: attempts.length,
      subject: scope?.subject ?? null,
      progressSubject: progressQuiz?.subject ?? null,
      progress: buildProgress(answers, progress).map((p) => ({
        ...p,
        submittedAt: p.submittedAt.toISOString(),
      })),
      topics: review.map((t) => {
        const suggested = selectSuggestions(candidates.filter((c) => c.topicId === t.topicId));
        const available = suggested.length > 0;
        return {
          ...t,
          subject: subjectByTopic.get(t.topicId) ?? null,
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
