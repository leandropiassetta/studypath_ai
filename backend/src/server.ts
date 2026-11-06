import { buildApp } from './app.js';
import { loadEnv } from './config/env.js';
import { createExplanationProvider } from './modules/ai/providers/index.js';
import { createDataSource } from './database/data-source.js';

const env = loadEnv();
const dataSource = createDataSource(env.DATABASE_URL);
await dataSource.initialize();
const app = buildApp({
  dataSource,
  explanationProvider: createExplanationProvider(env),
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
