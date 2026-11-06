import { describe, expect, it } from 'vitest';
import { AppError } from '../../src/shared/errors/app-error.js';
import { ReviewService } from '../../src/modules/reviews/service.js';
import type { RecommendationRepository } from '../../src/modules/recommendations/repository.js';
import type { ReviewRepository } from '../../src/modules/reviews/repository.js';
import type { QuizRepository } from '../../src/modules/quizzes/repository.js';

const DEMO = 'demo';
const TOPIC = 'topic-1';

const recs = (unanswered: unknown[] = []) =>
  ({
    studentExists: async () => true,
    history: async () => ({
      attempts: [{ id: 'a1', submittedAt: new Date(), scorePct: 0, kind: 'standard' }],
      answers: [
        { attemptId: 'a1', questionId: 'q1', topicId: TOPIC, topicName: 'T', isCorrect: false },
        { attemptId: 'a1', questionId: 'q2', topicId: TOPIC, topicName: 'T', isCorrect: false },
      ],
    }),
    unansweredQuestions: async () => unanswered,
  }) as unknown as RecommendationRepository;

const reviews = (questions: unknown[]) =>
  ({
    findTopic: async () => ({ id: TOPIC, name: 'T' }),
    questionsById: async () => questions,
    ensureReviewQuiz: async () => undefined,
  }) as unknown as ReviewRepository;

const quizzes = { findActiveBySlug: async () => null } as unknown as QuizRepository;

describe('ReviewService edge cases', () => {
  it('refuses to create an empty quiz when no question can be selected', async () => {
    // Inconsistent data: the topic needs review, but its wrong questions cannot be loaded.
    const svc = new ReviewService(recs([]), reviews([]), quizzes, DEMO);
    const err = await svc.createForTopic(DEMO, TOPIC).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err).toMatchObject({ statusCode: 400, code: 'NOTHING_TO_PRACTICE' });
  });

  it('rejects any student other than the demo one before touching the database', async () => {
    const svc = new ReviewService(recs(), reviews([]), quizzes, DEMO);
    await expect(svc.createForTopic('someone-else', TOPIC)).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});
