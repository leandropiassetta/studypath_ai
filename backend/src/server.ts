import { buildApp } from './app.js';
import { loadEnv } from './config/env.js';
import { createDataSource } from './database/data-source.js';

const env = loadEnv();
const dataSource = createDataSource(env.DATABASE_URL);
await dataSource.initialize();
const app = buildApp({ dataSource, demoStudentId: env.DEMO_STUDENT_ID, logger: true });

const shutdown = async (): Promise<void> => {
  await app.close();
  await dataSource.destroy();
};
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => void shutdown().then(() => process.exit(0)));
}

try {
  await app.listen({ host: env.HOST, port: env.PORT });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
