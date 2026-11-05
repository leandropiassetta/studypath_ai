import { AppError, notFound } from '../../shared/errors/app-error.js';
import { canonicalPayloadHash, gradeAttempt, validateAnswers } from './domain.js';
import type { AttemptRepository } from './repository.js';
import type { AttemptResult, CreateAttemptInput } from './schemas.js';

export class AttemptService {
  constructor(
    private readonly attempts: AttemptRepository,
    private readonly demoStudentId: string,
  ) {}

  /** Check order: 403 student -> 404 student/quiz -> 400 answers -> grade and persist. */
  async submit(input: CreateAttemptInput): Promise<AttemptResult> {
    if (input.studentId !== this.demoStudentId) {
      throw new AppError(403, 'FORBIDDEN', 'Estudante não autorizado');
    }
    if (!(await this.attempts.studentExists(input.studentId))) {
      throw notFound('STUDENT_NOT_FOUND', 'Aluno não encontrado');
    }
    if (!(await this.attempts.quizIsActive(input.quizId))) {
      throw notFound('QUIZ_NOT_FOUND', 'Simulado não encontrado');
    }

    const keys = await this.attempts.getQuizKeys(input.quizId);
    const issues = validateAnswers(keys, input.answers);
    if (issues.length > 0) {
      throw new AppError(400, 'INVALID_ANSWERS', 'Respostas inválidas', issues);
    }

    const graded = gradeAttempt(keys, input.answers);
    const attemptId = await this.attempts.createAttempt({
      studentId: input.studentId,
      quizId: input.quizId,
      requestId: input.requestId,
      payloadHash: canonicalPayloadHash(input.quizId, input.answers),
      graded,
    });
    return { attemptId, quizId: input.quizId, ...graded };
  }
}
