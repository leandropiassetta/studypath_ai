import { buildApp } from './app.js';
import { loadEnv } from './config/env.js';
import { createExplanationProvider } from './modules/ai/providers/index.js';
import { UsageLimiter } from './modules/ai/usage.js';
import { createDoubtQueue } from './modules/doubts/jobs.js';
import { DoubtRepository } from './modules/doubts/repository.js';
import { ExplanationRepository } from './modules/ai/repository.js';
import { createDataSource } from './database/data-source.js';

const env = loadEnv();
const dataSource = createDataSource(env.DATABASE_URL);
await dataSource.initialize();
const logger = {
  info: (obj: object, msg: string) => console.log(msg, JSON.stringify(obj)),
  warn: (obj: object, msg: string) => console.warn(msg, JSON.stringify(obj)),
};
const explanationProvider = createExplanationProvider(env);
const queue = env.REDIS_URL
  ? createDoubtQueue({
      redisUrl: env.REDIS_URL,
      slaDelayMs: env.SLA_DELAY_MS,
      deps: {
        doubts: new DoubtRepository(dataSource),
        answers: new ExplanationRepository(dataSource),
        provider: explanationProvider,
        timeoutMs: env.AI_TIMEOUT_MS,
        log: logger,
        limiter: new UsageLimiter({
          perMinute: env.AI_MAX_CALLS_PER_MINUTE,
          perDay: env.AI_MAX_CALLS_PER_DAY,
        }),
      },
    })
  : null;
const app = buildApp({
  doubtJobs: queue?.jobs,
  dataSource,
  explanationProvider,
  aiTimeoutMs: env.AI_TIMEOUT_MS,
  auth: { sessionTtlMs: env.SESSION_TTL_DAYS * 24 * 60 * 60_000 },
  aiLimits: {
    perMinute: env.AI_MAX_CALLS_PER_MINUTE,
    perDay: env.AI_MAX_CALLS_PER_DAY,
  },
  logger: true,
});

const shutdown = async (): Promise<void> => {
  await app.close();
  await queue?.close();
  await dataSource.destroy();
};
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    shutdown().then(
      () => process.exit(0),
      (err: unknown) => {
        app.log.error(err);
        process.exit(1);
      },
    );
  });
}

try {
  await app.listen({ host: env.HOST, port: env.PORT });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
