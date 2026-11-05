import type { FastifyBaseLogger } from 'fastify';
import { AppError, notFound } from '../../shared/errors/app-error.js';
import type { ExplanationProvider } from './providers/types.js';
import type { ExplanationRepository } from './repository.js';
import type { ExplanationView } from './schemas.js';
import { parseExplanation } from './validate.js';

async function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('LLM timeout'));
    }, ms);
  });
  try {
    // Race so a provider that ignores the abort signal still cannot hold the request.
    return await Promise.race([run(controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export class ExplanationService {
  constructor(
    private readonly repo: ExplanationRepository,
    private readonly demoStudentId: string,
    private readonly provider: ExplanationProvider | null,
    private readonly timeoutMs: number,
  ) {}

  /** RN-11: the LLM only produces text. Any failure falls back to the reference explanation. */
  async explain(
    attemptId: string,
    questionId: string,
    log: FastifyBaseLogger,
  ): Promise<ExplanationView> {
    const lookup = await this.repo.findAnswer(attemptId, questionId);
    if (lookup.found === 'no-attempt')
      throw notFound('ATTEMPT_NOT_FOUND', 'Tentativa não encontrada');

    const studentId = lookup.found === 'answer' ? lookup.context.studentId : lookup.studentId;
    if (studentId !== this.demoStudentId) {
      throw new AppError(403, 'FORBIDDEN', 'Estudante não autorizado');
    }
    if (lookup.found === 'no-answer') {
      throw notFound('QUESTION_NOT_FOUND', 'Questão não encontrada nesta tentativa');
    }

    const { isCorrect, ...input } = lookup.context;
    if (isCorrect) {
      throw new AppError(
        400,
        'QUESTION_NOT_INCORRECT',
        'A questão não foi respondida incorretamente',
      );
    }

    const reference: ExplanationView = {
      questionId,
      explanation: input.referenceExplanation,
      source: 'reference',
    };
    if (!this.provider) return reference;

    try {
      const raw = await withTimeout(
        (signal) => this.provider!.explain(input, signal),
        this.timeoutMs,
      );
      const text = parseExplanation(raw);
      if (text === null) {
        log.warn('LLM output rejected by validation; using reference explanation');
        return reference;
      }
      return { questionId, explanation: text, source: 'llm' };
    } catch (err) {
      // Log only the error message: never prompts, answers or keys.
      log.warn(
        { reason: err instanceof Error ? err.message : 'unknown' },
        'LLM unavailable; using reference explanation',
      );
      return reference;
    }
  }
}
