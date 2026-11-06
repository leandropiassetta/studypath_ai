import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import type { ExplanationProvider } from '../ai/providers/types.js';
import type { ExplanationRepository } from '../ai/repository.js';
import { withTimeout } from '../ai/timeout.js';
import type { UsageLimiter } from '../ai/usage.js';
import { parseAnalysis } from '../ai/validate.js';
import type { DoubtRepository } from './repository.js';

/** What the doubt service needs from the background machinery. Must never throw. */
export interface DoubtJobs {
  onTeacherRequested(doubtId: string): Promise<void>;
}

export interface JobLogger {
  info(obj: object, msg: string): void;
  warn(obj: object, msg: string): void;
}

export interface JobDeps {
  doubts: DoubtRepository;
  answers: ExplanationRepository;
  provider: ExplanationProvider | null;
  timeoutMs: number;
  log: JobLogger;
  /** Same cost guard as the hints: an over-limit student gets the plain summary, not a model call. */
  limiter?: UsageLimiter;
}

/**
 * Fills `doubts.misconception` for the teacher. Safe to run twice (never overwrites). The LLM is
 * optional: after the last failed attempt, or with no LLM at all, a plain deterministic sentence
 * is saved so the teacher's queue never depends on the model being up.
 */
export async function processEnrich(
  deps: JobDeps,
  doubtId: string,
  isLastAttempt: boolean,
): Promise<void> {
  const doubt = await deps.doubts.findById(doubtId);
  if (!doubt) return;
  const lookup = await deps.answers.findAnswer(doubt.attemptId, doubt.questionId);
  if (lookup.found !== 'answer') return;
  const c = lookup.context;
  const fallback = `Marcou ${c.selectedOption} em vez de ${c.correctOption}.`;

  const provider = deps.provider;
  if (!provider?.analyze || (deps.limiter && deps.limiter.tryAcquire(doubt.studentId) !== 'ok')) {
    await deps.doubts.saveMisconception(doubtId, fallback);
    return;
  }
  try {
    const raw = await withTimeout(
      (signal) =>
        provider.analyze!(
          {
            statement: c.statement,
            options: c.options,
            selectedOption: c.selectedOption,
            correctOption: c.correctOption,
            referenceExplanation: c.referenceExplanation,
            studentMessage: doubt.message ?? undefined,
          },
          signal,
        ),
      deps.timeoutMs,
    );
    const text = parseAnalysis(raw);
    if (text === null) throw new Error('analysis output rejected by validation');
    await deps.doubts.saveMisconception(doubtId, text);
  } catch (err) {
    if (!isLastAttempt) throw err; // let BullMQ retry with backoff
    deps.log.warn(
      { reason: err instanceof Error ? err.message : 'unknown' },
      'analysis failed on the last attempt; saving the plain summary',
    );
    await deps.doubts.saveMisconception(doubtId, fallback);
  }
}

/** Runs ~14 minutes after the student called a teacher; flags the doubt only if still waiting. */
export async function processSla(deps: JobDeps, doubtId: string): Promise<void> {
  if (await deps.doubts.markSlaBreached(doubtId)) {
    deps.log.warn({ doubtId }, 'doubt is still waiting for a teacher past the promised time');
  }
}

const DEFAULT_QUEUE = 'doubts';
export const ENRICH_ATTEMPTS = 3;
const ENQUEUE_TIMEOUT_MS = 2000;

export interface DoubtQueueOptions {
  redisUrl: string;
  slaDelayMs: number;
  deps: JobDeps;
  backoffMs?: number;
  /** Tests use their own queue so they never compete with a running API for jobs. */
  queueName?: string;
}

export interface DoubtQueue {
  jobs: DoubtJobs;
  close(): Promise<void>;
}

function connectionFrom(redisUrl: string): ConnectionOptions {
  const u = new URL(redisUrl);
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    username: u.username ? decodeURIComponent(u.username) : undefined,
    password: u.password ? decodeURIComponent(u.password) : undefined,
    ...(u.protocol === 'rediss:' ? { tls: {} } : {}),
  };
}

/** The producer and the worker live in the API process: one less thing to run for a demo. */
export function createDoubtQueue(options: DoubtQueueOptions): DoubtQueue {
  const { deps } = options;
  // The producer fails fast when Redis is down instead of hanging the HTTP request.
  const name = options.queueName ?? DEFAULT_QUEUE;
  const queue = new Queue(name, {
    connection: { ...connectionFrom(options.redisUrl), enableOfflineQueue: false },
  });
  queue.on('error', (err) => deps.log.warn({ reason: err.message }, 'queue connection problem'));

  const worker = new Worker(
    name,
    async (job) => {
      const doubtId = String(job.data.doubtId);
      if (job.name === 'enrich') {
        await processEnrich(deps, doubtId, job.attemptsMade + 1 >= (job.opts.attempts ?? 1));
      } else if (job.name === 'sla') {
        await processSla(deps, doubtId);
      }
    },
    { connection: connectionFrom(options.redisUrl), concurrency: 2 },
  );
  worker.on('error', (err) => deps.log.warn({ reason: err.message }, 'worker connection problem'));
  worker.on('failed', (job, err) =>
    deps.log.warn(
      { job: job?.name, attempt: job?.attemptsMade, reason: err.message },
      'background job failed',
    ),
  );

  return {
    jobs: {
      async onTeacherRequested(doubtId) {
        try {
          // Bounded: with Redis down the client keeps reconnecting and would hold the request.
          await withTimeout(() => enqueue(doubtId), ENQUEUE_TIMEOUT_MS);
        } catch (err) {
          deps.log.warn(
            { reason: err instanceof Error ? err.message : 'unknown' },
            'could not enqueue background jobs; continuing without them',
          );
        }
      },
    },
    async close() {
      await withTimeout(() => worker.close(), 3000).catch(() => undefined);
      await withTimeout(() => queue.close(), 3000).catch(() => undefined);
    },
  };

  async function enqueue(doubtId: string): Promise<void> {
    // Job ids are the doubt id: tapping "chamar professor" twice never schedules twice.
    await queue.add(
      'enrich',
      { doubtId },
      {
        jobId: `enrich-${doubtId}`,
        attempts: ENRICH_ATTEMPTS,
        backoff: { type: 'exponential', delay: options.backoffMs ?? 2000 },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    );
    await queue.add(
      'sla',
      { doubtId },
      {
        jobId: `sla-${doubtId}`,
        delay: options.slaDelayMs,
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    );
  }
}
