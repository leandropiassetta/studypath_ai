import Fastify, { type FastifyInstance } from 'fastify';
import type { DataSource } from 'typeorm';
import { healthRoutes } from './modules/health/routes.js';
import { QuizRepository } from './modules/quizzes/repository.js';
import { quizRoutes } from './modules/quizzes/routes.js';
import { QuizService } from './modules/quizzes/service.js';
import { registerErrorHandling } from './shared/errors/error-handler.js';

export interface AppOptions {
  dataSource: DataSource;
  logger?: boolean;
}

export function buildApp({ dataSource, logger = false }: AppOptions): FastifyInstance {
  const app = Fastify({ logger });
  registerErrorHandling(app);

  void app.register(healthRoutes(dataSource));
  void app.register(quizRoutes(new QuizService(new QuizRepository(dataSource))), {
    prefix: '/api/v1',
  });
  return app;
}
