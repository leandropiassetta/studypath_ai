import type { FastifyBaseLogger } from 'fastify';
import { AppError, notFound } from '../../shared/errors/app-error.js';
import type { ExplanationProvider, HintInput, HintLevel } from '../ai/providers/types.js';
import type { ExplanationRepository } from '../ai/repository.js';
import { withTimeout } from '../ai/timeout.js';
import { DEFAULT_USAGE_LIMITS, UsageLimiter, type UsageLimits } from '../ai/usage.js';
import { parseHint } from '../ai/validate.js';
import type { DoubtJobs } from './jobs.js';
import { leaksAnswer, referenceHint } from './hints.js';
import type { DoubtRecord, DoubtRepository } from './repository.js';
import {
  ETA_MINUTES,
  MAX_HINTS,
  type CreateDoubtInput,
  type DoubtView,
  type FeedbackInput,
  type HintResult,
  type TeacherDoubtView,
} from './schemas.js';

const LIMIT_NOTICE =
  'Muitas dicas em pouco tempo. Mostrando a dica padrão; tente a IA de novo em instantes.';

export class DoubtService {
  private readonly limiter: UsageLimiter;
  private readonly now: () => number;

  constructor(
    private readonly doubts: DoubtRepository,
    private readonly answers: ExplanationRepository,
    private readonly provider: ExplanationProvider | null,
    private readonly timeoutMs: number,
    limits: UsageLimits = DEFAULT_USAGE_LIMITS,
    now: () => number = Date.now,
    private readonly jobs?: DoubtJobs,
  ) {
    this.limiter = new UsageLimiter(limits, now);
    this.now = now;
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
      // The last hint is the full solution: it has to actually conclude with the answer.
      if (input.level >= MAX_HINTS && !leaksAnswer(text, input)) {
        log.warn('Final hint does not state the answer; using the reference solution');
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

  /** "Chamar professor": the doubt joins the teachers' queue. Idempotent. */
  async requestTeacher(studentId: string, doubtId: string): Promise<DoubtView> {
    const doubt = await this.doubts.findOwned(doubtId, studentId);
    if (!doubt) throw notFound('DOUBT_NOT_FOUND', 'Dúvida não encontrada');
    if (doubt.status === 'AI_HINTS') {
      await this.doubts.requestTeacher(doubtId, studentId);
      // Background work never blocks or fails the request: the queue is a bonus, not a dependency.
      await this.jobs?.onTeacherRequested(doubtId);
    }
    return this.get(studentId, doubtId);
  }

  /** "Isso ajudou?" for the AI hints and, once it exists, for the teacher's answer. */
  async sendFeedback(
    studentId: string,
    doubtId: string,
    feedback: FeedbackInput,
  ): Promise<DoubtView> {
    const doubt = await this.doubts.findOwned(doubtId, studentId);
    if (!doubt) throw notFound('DOUBT_NOT_FOUND', 'Dúvida não encontrada');
    if (feedback.aiHelpful !== undefined && doubt.hintsUsed === 0) {
      throw new AppError(409, 'NO_HINTS_YET', 'Peça uma dica antes de avaliar a ajuda da IA');
    }
    if (feedback.teacherHelpful !== undefined && doubt.status !== 'ANSWERED') {
      throw new AppError(409, 'NOT_ANSWERED_YET', 'O professor ainda não respondeu');
    }
    await this.doubts.saveFeedback(doubtId, studentId, feedback);
    return this.get(studentId, doubtId);
  }

  /** Teacher side: the queue, with the context already prepared. */
  async teacherQueue(
    teacherId: string,
    status: 'waiting' | 'answered',
  ): Promise<TeacherDoubtView[]> {
    const rows = await this.doubts.teacherList(status, teacherId);
    const hints = await this.doubts.hintsFor(rows.map((r) => r.id));
    const now = this.now();
    return rows.map((r) => ({
      id: r.id,
      status: r.status,
      studentFirstName: r.student_name.trim().split(/\s+/)[0] ?? r.student_name, // first name only
      topic: r.topic,
      statement: r.statement,
      options: r.options,
      selectedOption: r.selected_option,
      correctOption: r.correct_option,
      referenceExplanation: r.reference_explanation,
      message: r.message,
      misconception: r.misconception,
      hintsUsed: r.hints_used,
      aiHints: hints.get(r.id) ?? [],
      requestedAt: r.teacher_requested_at.toISOString(),
      slaBreached: r.sla_breached_at !== null,
      waitingMinutes: Math.max(0, Math.floor((now - r.teacher_requested_at.getTime()) / 60_000)),
      answer: r.teacher_answer,
      answeredAt: r.answered_at?.toISOString() ?? null,
    }));
  }

  async teacherAnswer(teacherId: string, doubtId: string, answer: string): Promise<void> {
    const text = answer.trim();
    if (text.length === 0) throw new AppError(400, 'INVALID_REQUEST', 'Resposta vazia');
    if (!(await this.doubts.answer(doubtId, teacherId, text))) {
      // Either it does not exist, was never sent to teachers, or someone already answered it.
      throw new AppError(409, 'NOT_WAITING', 'Esta dúvida não está aguardando resposta');
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
      teacherRequestedAt: doubt.teacherRequestedAt?.toISOString() ?? null,
      etaMinutes: ETA_MINUTES,
      teacherAnswer: doubt.teacherAnswer,
      answeredAt: doubt.answeredAt?.toISOString() ?? null,
      aiHelpful: doubt.aiHelpful,
      teacherHelpful: doubt.teacherHelpful,
    };
  }
}
