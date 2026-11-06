import { AppError, notFound } from '../../shared/errors/app-error.js';
import { assertSameStudent } from '../../shared/errors/guards.js';
import { canonicalPayloadHash, gradeAttempt, validateAnswers } from './domain.js';
import { DuplicateRequestError, type AttemptRepository, type StoredAttempt } from './repository.js';
import type { AttemptResult, CreateAttemptInput } from './schemas.js';

export interface SubmitOutcome {
  /** true: new attempt (HTTP 201). false: idempotent replay of an existing one (HTTP 200). */
  created: boolean;
  result: AttemptResult;
}

export class AttemptService {
  constructor(private readonly attempts: AttemptRepository) {}

  /**
   * Check order: 403 student mismatch -> idempotency lookup (200 / 409) -> 404 quiz
   * -> 400 answers -> grade and persist. The replay comes BEFORE the "quiz is active" check: a
   * valid attempt must stay retrievable even if the quiz was deactivated afterwards. A concurrent
   * duplicate loses the unique index race and is resolved by re-reading the winning attempt.
   */
  async submit(authStudentId: string, input: CreateAttemptInput): Promise<SubmitOutcome> {
    assertSameStudent(input.studentId, authStudentId);

    const payloadHash = canonicalPayloadHash(input.quizId, input.answers);
    const existing = await this.attempts.findByRequest(input.studentId, input.requestId);
    if (existing) return this.replay(existing, payloadHash);

    if (!(await this.attempts.quizIsActive(input.quizId))) {
      throw notFound('QUIZ_NOT_FOUND', 'Simulado não encontrado');
    }

    const keys = await this.attempts.getQuizKeys(input.quizId);
    const issues = validateAnswers(keys, input.answers);
    if (issues.length > 0) {
      throw new AppError(400, 'INVALID_ANSWERS', 'Respostas inválidas', issues);
    }

    const graded = gradeAttempt(keys, input.answers);
    try {
      const attemptId = await this.attempts.createAttempt({
        studentId: input.studentId,
        quizId: input.quizId,
        requestId: input.requestId,
        payloadHash,
        graded,
      });
      return { created: true, result: { attemptId, quizId: input.quizId, ...graded } };
    } catch (err) {
      if (!(err instanceof DuplicateRequestError)) throw err;
      const winner = await this.attempts.findByRequest(input.studentId, input.requestId);
      if (!winner) throw err;
      return this.replay(winner, payloadHash);
    }
  }

  /** Same request + same payload -> original result; same request + different payload -> 409. */
  private async replay(existing: StoredAttempt, payloadHash: string): Promise<SubmitOutcome> {
    if (existing.payloadHash !== payloadHash) {
      throw new AppError(
        409,
        'REQUEST_ID_CONFLICT',
        'requestId já utilizado com conteúdo diferente',
      );
    }
    // The result exactly as the student first saw it: never re-graded against current questions.
    if (existing.result) {
      return {
        created: false,
        result: { attemptId: existing.id, quizId: existing.quizId, ...existing.result },
      };
    }
    // Legacy attempt (made before snapshots): rebuild once from the current questions, keep the
    // stored correctness, and freeze it so it can never drift again.
    const keys = await this.attempts.getQuizKeys(existing.quizId);
    const stored = await this.attempts.getStoredAnswers(existing.id);
    const graded = gradeAttempt(keys, stored.answers, stored.correctness);
    await this.attempts.saveResultIfMissing(existing.id, graded);
    return {
      created: false,
      result: { attemptId: existing.id, quizId: existing.quizId, ...graded },
    };
  }
}
