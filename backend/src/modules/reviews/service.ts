import { AppError, notFound } from '../../shared/errors/app-error.js';
import { assertDemoStudent } from '../../shared/errors/guards.js';
import type { QuizRepository } from '../quizzes/repository.js';
import { latestAnswerPerQuestion, selectReviewTopics } from '../recommendations/domain.js';
import type { RecommendationRepository } from '../recommendations/repository.js';
import { composeReviewSelection, reviewSlug } from './domain.js';
import type { ReviewRepository } from './repository.js';
import type { ReviewQuizView } from './schemas.js';

export class ReviewService {
  constructor(
    private readonly recommendations: RecommendationRepository,
    private readonly reviews: ReviewRepository,
    private readonly quizzes: QuizRepository,
    private readonly demoStudentId: string,
  ) {}

  /** Check order: 403 student -> 404 student/topic -> 400 topic not in review. */
  async createForTopic(studentId: string, topicId: string): Promise<ReviewQuizView> {
    assertDemoStudent(studentId, this.demoStudentId);
    if (!(await this.recommendations.studentExists(studentId))) {
      throw notFound('STUDENT_NOT_FOUND', 'Aluno não encontrado');
    }
    const topic = await this.reviews.findTopic(topicId);
    if (!topic) throw notFound('TOPIC_NOT_FOUND', 'Assunto não encontrado');

    const history = await this.recommendations.history(studentId);
    const current = latestAnswerPerQuestion(
      history.answers,
      history.attempts.map((a) => a.id),
    );
    if (!selectReviewTopics(current).some((t) => t.topicId === topicId)) {
      throw new AppError(
        400,
        'TOPIC_NOT_IN_REVIEW',
        'Este assunto não precisa de revisão no momento',
      );
    }

    const unseen = await this.recommendations.unansweredQuestions(studentId, [topicId]);
    const wrongIds = current
      .filter((a) => a.topicId === topicId && !a.isCorrect)
      .map((a) => a.questionId);
    const selection = composeReviewSelection(unseen, await this.reviews.questionsById(wrongIds));

    if (selection.questionIds.length === 0) {
      throw new AppError(400, 'NOTHING_TO_PRACTICE', 'Não há questões para praticar neste assunto');
    }

    const slug = reviewSlug(selection.questionIds);
    await this.reviews.ensureReviewQuiz(slug, `Revisão: ${topic.name}`, selection.questionIds);
    const quiz = await this.quizzes.findActiveBySlug(slug);
    if (!quiz) throw new Error('review quiz not found right after creation');
    return { ...quiz, newCount: selection.newCount, retryCount: selection.retryCount };
  }
}
