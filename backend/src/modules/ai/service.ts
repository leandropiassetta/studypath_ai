import type { FastifyBaseLogger } from 'fastify';
import { AppError, notFound } from '../../shared/errors/app-error.js';
import type { ExplanationInput, ExplanationProvider } from './providers/types.js';
import type { ExplanationRepository } from './repository.js';
import type { ExplanationView } from './schemas.js';
import { withTimeout } from './timeout.js';
import { parseExplanation } from './validate.js';
import {
  DEFAULT_USAGE_LIMITS,
  ExplanationCache,
  UsageLimiter,
  type LimitVerdict,
  type UsageLimits,
} from './usage.js';

const LIMIT_NOTICES: Record<Exclude<LimitVerdict, 'ok'>, string> = {
  minute:
    'Muitas explicações em pouco tempo. Mostrando a explicação de referência; tente a IA de novo em instantes.',
  day: 'Limite de explicações por IA atingido (24 h). Mostrando a explicação de referência.',
};

export class ExplanationService {
  private readonly limiter: UsageLimiter;
  private readonly cache: ExplanationCache;
  /** Concurrent identical requests share one LLM call (single flight). */
  private readonly inflight = new Map<string, Promise<ExplanationView>>();

  constructor(
    private readonly repo: ExplanationRepository,
    private readonly provider: ExplanationProvider | null,
    private readonly timeoutMs: number,
    limits: UsageLimits = DEFAULT_USAGE_LIMITS,
    now: () => number = Date.now,
  ) {
    this.limiter = new UsageLimiter(limits, now);
    this.cache = new ExplanationCache(500, 24 * 60 * 60_000, now);
  }

  /** RN-11: the LLM only produces text. Any failure or limit falls back to the reference text. */
  async explain(
    authStudentId: string,
    attemptId: string,
    questionId: string,
    log: FastifyBaseLogger,
  ): Promise<ExplanationView> {
    const lookup = await this.repo.findAnswer(attemptId, questionId);
    if (lookup.found === 'no-attempt')
      throw notFound('ATTEMPT_NOT_FOUND', 'Tentativa não encontrada');

    const studentId = lookup.found === 'answer' ? lookup.context.studentId : lookup.studentId;
    // Someone else's attempt is reported as not found, so ids cannot be probed.
    if (studentId !== authStudentId)
      throw notFound('ATTEMPT_NOT_FOUND', 'Tentativa não encontrada');
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
    const provider = this.provider;
    if (!provider) return reference;

    // Cost guards, cheapest first: cache -> single flight -> rate limit -> LLM call.
    const key = `${attemptId}:${questionId}`;
    const cached = this.cache.get(key);
    if (cached !== undefined) return { questionId, explanation: cached, source: 'llm' };

    const pending = this.inflight.get(key);
    if (pending) return pending;

    const verdict = this.limiter.tryAcquire(studentId);
    if (verdict !== 'ok') {
      log.warn({ limit: verdict }, 'AI usage limit reached; using reference explanation');
      return { ...reference, notice: LIMIT_NOTICES[verdict] };
    }

    const call = this.callProvider(provider, key, input, reference, log).finally(() => {
      this.inflight.delete(key);
    });
    this.inflight.set(key, call);
    return call;
  }

  private async callProvider(
    provider: ExplanationProvider,
    key: string,
    input: ExplanationInput,
    reference: ExplanationView,
    log: FastifyBaseLogger,
  ): Promise<ExplanationView> {
    try {
      const raw = await withTimeout((signal) => provider.explain(input, signal), this.timeoutMs);
      const text = parseExplanation(raw);
      if (text === null) {
        log.warn('LLM output rejected by validation; using reference explanation');
        return reference;
      }
      this.cache.set(key, text);
      return { questionId: reference.questionId, explanation: text, source: 'llm' };
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
