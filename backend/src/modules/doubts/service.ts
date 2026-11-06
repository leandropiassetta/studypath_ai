import type { FastifyBaseLogger } from 'fastify';
import { AppError, notFound } from '../../shared/errors/app-error.js';
import type { ExplanationProvider, HintInput, HintLevel } from '../ai/providers/types.js';
import type { ExplanationRepository } from '../ai/repository.js';
import { withTimeout } from '../ai/timeout.js';
import { DEFAULT_USAGE_LIMITS, UsageLimiter, type UsageLimits } from '../ai/usage.js';
import { parseHint } from '../ai/validate.js';
import { leaksAnswer, referenceHint } from './hints.js';
import type { DoubtRecord, DoubtRepository } from './repository.js';
import { MAX_HINTS, type CreateDoubtInput, type DoubtView, type HintResult } from './schemas.js';

const LIMIT_NOTICE =
  'Muitas dicas em pouco tempo. Mostrando a dica padrão; tente a IA de novo em instantes.';

export class DoubtService {
  private readonly limiter: UsageLimiter;

  constructor(
    private readonly doubts: DoubtRepository,
    private readonly answers: ExplanationRepository,
    private readonly provider: ExplanationProvider | null,
    private readonly timeoutMs: number,
    limits: UsageLimits = DEFAULT_USAGE_LIMITS,
    now: () => number = Date.now,
  ) {
    this.limiter = new UsageLimiter(limits, now);
  }

  /** A doubt exists only for a question this student got wrong in their own attempt. */
  async open(
    studentId: string,
    input: CreateDoubtInput,
  ): Promise<{ doubt: DoubtView; created: boolean }> {
    const lookup = await this.answers.findAnswer(input.attemptId, input.questionId);
    const owner =
      lookup.found === 'answer'
        ? lookup.context.studentId
        : lookup.found === 'no-answer'
          ? lookup.studentId
          : null;
    if (owner === null || owner !== studentId) {
      throw notFound('ATTEMPT_NOT_FOUND', 'Tentativa não encontrada'); // also hides other students' attempts
    }
    if (lookup.found === 'no-answer') {
      throw notFound('QUESTION_NOT_FOUND', 'Questão não encontrada nesta tentativa');
    }
    if (lookup.found === 'answer' && lookup.context.isCorrect) {
      throw new AppError(
        400,
        'QUESTION_NOT_INCORRECT',
        'A questão não foi respondida incorretamente',
      );
    }

    const { doubt, created } = await this.doubts.openOrGet({
      studentId,
      attemptId: input.attemptId,
      questionId: input.questionId,
      message: input.message?.trim() || null,
    });
    return { doubt: await this.view(doubt), created };
  }

  async get(studentId: string, doubtId: string): Promise<DoubtView> {
    const doubt = await this.doubts.findOwned(doubtId, studentId);
    if (!doubt) throw notFound('DOUBT_NOT_FOUND', 'Dúvida não encontrada');
    return this.view(doubt);
  }

  /** Hints are given strictly in order: 1, 2, then 3 (the full solution). */
  async nextHint(studentId: string, doubtId: string, log: FastifyBaseLogger): Promise<HintResult> {
    const doubt = await this.doubts.findOwned(doubtId, studentId);
    if (!doubt) throw notFound('DOUBT_NOT_FOUND', 'Dúvida não encontrada');

    const level = await this.doubts.claimNextLevel(doubtId, studentId, MAX_HINTS);
    if (level === null) {
      throw new AppError(409, 'ALL_HINTS_USED', 'Você já viu todas as dicas desta dúvida');
    }

    const lookup = await this.answers.findAnswer(doubt.attemptId, doubt.questionId);
    if (lookup.found !== 'answer') throw notFound('QUESTION_NOT_FOUND', 'Questão não encontrada');
    const c = lookup.context;
    const input: HintInput = {
      statement: c.statement,
      options: c.options,
      selectedOption: c.selectedOption,
      correctOption: c.correctOption,
      referenceExplanation: c.referenceExplanation,
      level: level as HintLevel,
      studentMessage: doubt.message ?? undefined,
    };

    const { text, source, notice } = await this.generate(studentId, input, log);
    await this.doubts.saveHint(doubtId, { level, text, source });
    return {
      level,
      text,
      source,
      ...(notice ? { notice } : {}),
      hintsUsed: level,
      hasMore: level < MAX_HINTS,
    };
  }

  private async generate(
    studentId: string,
    input: HintInput,
    log: FastifyBaseLogger,
  ): Promise<{ text: string; source: 'llm' | 'reference'; notice?: string }> {
    const fallback = { text: referenceHint(input, input.level), source: 'reference' as const };
    const provider = this.provider;
    if (!provider?.hint) return fallback;

    if (this.limiter.tryAcquire(studentId) !== 'ok') {
      log.warn('AI usage limit reached; using the reference hint');
      return { ...fallback, notice: LIMIT_NOTICE };
    }
    try {
      const raw = await withTimeout((signal) => provider.hint!(input, signal), this.timeoutMs);
      const text = parseHint(raw);
      if (text === null) {
        log.warn('Hint output rejected by validation; using the reference hint');
        return fallback;
      }
      if (input.level < MAX_HINTS && leaksAnswer(text, input)) {
        log.warn({ level: input.level }, 'Hint would reveal the answer; using the reference hint');
        return fallback;
      }
      return { text, source: 'llm' };
    } catch (err) {
      log.warn(
        { reason: err instanceof Error ? err.message : 'unknown' },
        'LLM unavailable; using the reference hint',
      );
      return fallback;
    }
  }

  private async view(doubt: DoubtRecord): Promise<DoubtView> {
    return {
      id: doubt.id,
      attemptId: doubt.attemptId,
      questionId: doubt.questionId,
      status: doubt.status,
      message: doubt.message,
      hintsUsed: doubt.hintsUsed,
      maxHints: MAX_HINTS,
      hints: await this.doubts.listHints(doubt.id),
    };
  }
}
