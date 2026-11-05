import Fastify, { type FastifyInstance } from 'fastify';
import type { DataSource } from 'typeorm';
import { ExplanationRepository } from './modules/ai/repository.js';
import { explanationRoutes } from './modules/ai/routes.js';
import { ExplanationService } from './modules/ai/service.js';
import type { ExplanationProvider } from './modules/ai/providers/types.js';
import { AttemptRepository } from './modules/attempts/repository.js';
import { attemptRoutes } from './modules/attempts/routes.js';
import { AttemptService } from './modules/attempts/service.js';
import { RecommendationRepository } from './modules/recommendations/repository.js';
import { recommendationRoutes } from './modules/recommendations/routes.js';
import { RecommendationService } from './modules/recommendations/service.js';
import { healthRoutes } from './modules/health/routes.js';
import { QuizRepository } from './modules/quizzes/repository.js';
import { quizRoutes } from './modules/quizzes/routes.js';
import { QuizService } from './modules/quizzes/service.js';
import { registerLoopbackCors } from './shared/http/cors.js';
import { registerErrorHandling } from './shared/errors/error-handler.js';

export interface AppOptions {
  dataSource: DataSource;
  demoStudentId: string;
  /** null = AI disabled: explanations always come from the reference text. */
  explanationProvider?: ExplanationProvider | null;
  aiTimeoutMs?: number;
  logger?: boolean;
}

export function buildApp({
  dataSource,
  demoStudentId,
  explanationProvider = null,
  aiTimeoutMs = 8000,
  logger = false,
}: AppOptions): FastifyInstance {
  const app = Fastify({ logger });
  registerErrorHandling(app);
  registerLoopbackCors(app);

  void app.register(healthRoutes(dataSource));
  void app.register(quizRoutes(new QuizService(new QuizRepository(dataSource))), {
    prefix: '/api/v1',
  });
  void app.register(
    attemptRoutes(new AttemptService(new AttemptRepository(dataSource), demoStudentId)),
    {
      prefix: '/api/v1',
    },
  );
  void app.register(
    recommendationRoutes(
      new RecommendationService(new RecommendationRepository(dataSource), demoStudentId),
    ),
    { prefix: '/api/v1' },
  );
  void app.register(
    explanationRoutes(
      new ExplanationService(
        new ExplanationRepository(dataSource),
        demoStudentId,
        explanationProvider,
        aiTimeoutMs,
      ),
    ),
    { prefix: '/api/v1' },
  );
  return app;
}
