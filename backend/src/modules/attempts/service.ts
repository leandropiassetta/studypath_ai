import { AppError, notFound } from '../../shared/errors/app-error.js';
import { assertDemoStudent } from '../../shared/errors/guards.js';
import { canonicalPayloadHash, gradeAttempt, validateAnswers } from './domain.js';
import { DuplicateRequestError, type AttemptRepository, type StoredAttempt } from './repository.js';
import type { AttemptResult, CreateAttemptInput } from './schemas.js';

export interface SubmitOutcome {
  /** true: new attempt (HTTP 201). false: idempotent replay of an existing one (HTTP 200). */
  created: boolean;
  result: AttemptResult;
}

export class AttemptService {
  constructor(
    private readonly attempts: AttemptRepository,
    private readonly demoStudentId: string,
  ) {}

  /**
   * Check order: 403 student -> 404 student/quiz -> idempotency lookup (200 / 409)
   * -> 400 answers -> grade and persist. A concurrent duplicate loses the unique index
   * race and is resolved by re-reading the winning attempt.
   */
  async submit(input: CreateAttemptInput): Promise<SubmitOutcome> {
    assertDemoStudent(input.studentId, this.demoStudentId);
    if (!(await this.attempts.studentExists(input.studentId))) {
      throw notFound('STUDENT_NOT_FOUND', 'Aluno não encontrado');
    }
    if (!(await this.attempts.quizIsActive(input.quizId))) {
      throw notFound('QUIZ_NOT_FOUND', 'Simulado não encontrado');
    }

    const payloadHash = canonicalPayloadHash(input.quizId, input.answers);
    const existing = await this.attempts.findByRequest(input.studentId, input.requestId);
    if (existing) return this.replay(existing, payloadHash);

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
    const keys = await this.attempts.getQuizKeys(existing.quizId);
    const stored = await this.attempts.getStoredAnswers(existing.id);
    const graded = gradeAttempt(keys, stored.answers, stored.correctness);
    return {
      created: false,
      result: { attemptId: existing.id, quizId: existing.quizId, ...graded },
    };
  }
}
