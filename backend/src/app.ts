import Fastify, { type FastifyInstance } from 'fastify';
import type { DataSource } from 'typeorm';
import { ExplanationRepository } from './modules/ai/repository.js';
import { explanationRoutes } from './modules/ai/routes.js';
import { ExplanationService } from './modules/ai/service.js';
import type { ExplanationProvider } from './modules/ai/providers/types.js';
import type { UsageLimits } from './modules/ai/usage.js';
import { AttemptRepository } from './modules/attempts/repository.js';
import { attemptRoutes } from './modules/attempts/routes.js';
import { AttemptService } from './modules/attempts/service.js';
import { AuthRepository } from './modules/auth/repository.js';
import { authRoutes } from './modules/auth/routes.js';
import { AuthService, DEFAULT_SESSION_TTL_MS } from './modules/auth/service.js';
import { DoubtRepository } from './modules/doubts/repository.js';
import { doubtRoutes } from './modules/doubts/routes.js';
import { DoubtService } from './modules/doubts/service.js';
import { ReviewRepository } from './modules/reviews/repository.js';
import { reviewRoutes } from './modules/reviews/routes.js';
import { ReviewService } from './modules/reviews/service.js';
import { RecommendationRepository } from './modules/recommendations/repository.js';
import { recommendationRoutes } from './modules/recommendations/routes.js';
import { RecommendationService } from './modules/recommendations/service.js';
import { healthRoutes } from './modules/health/routes.js';
import { QuizRepository } from './modules/quizzes/repository.js';
import { quizRoutes } from './modules/quizzes/routes.js';
import { QuizService } from './modules/quizzes/service.js';
import { createRequireAuth } from './shared/http/auth.js';
import { registerLoopbackCors } from './shared/http/cors.js';
import { registerErrorHandling } from './shared/errors/error-handler.js';

export interface AppOptions {
  dataSource: DataSource;
  /** null = AI disabled: explanations always come from the reference text. */
  explanationProvider?: ExplanationProvider | null;
  aiTimeoutMs?: number;
  /** Per-student cost guards for the LLM endpoint (defaults: 6 per minute, 50 per 24 h). */
  aiLimits?: UsageLimits;
  /** Session lifetime and scrypt cost (tests lower the cost to stay fast). */
  auth?: { sessionTtlMs?: number; passwordCost?: number; now?: () => number };
  logger?: boolean;
}

export function buildApp({
  dataSource,
  explanationProvider = null,
  aiTimeoutMs = 8000,
  aiLimits,
  auth: authOptions = {},
  logger = false,
}: AppOptions): FastifyInstance {
  const app = Fastify({
    // Payloads are tiny (a quiz has 8 answers); refuse anything bigger early.
    bodyLimit: 64 * 1024,
    // Defense in depth: even if request/response logging grows, credentials never reach the log.
    logger: logger
      ? {
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers["x-api-key"]',
              'req.headers.cookie',
              'res.headers["set-cookie"]',
            ],
            censor: '[REDACTED]',
          },
        }
      : false,
  });
  registerErrorHandling(app);

  // Tolerate `content-type: application/json` with an empty body (e.g. `POST /doubts/:id/hints` or
  // logout from curl). Anything else keeps the default behavior, including prototype-poisoning checks.
  const parseJson = app.getDefaultJsonParser('error', 'error');
  app.removeContentTypeParser('application/json');
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    if (body === '') return done(null, undefined);
    parseJson(req, body as string, done);
  });
  registerLoopbackCors(app);
  app.addHook('onSend', async (req, reply, payload) => {
    void reply.header('x-content-type-options', 'nosniff');
    // Answers, scores and recommendations are personal data: never let a cache keep them.
    if (req.url.startsWith('/api/')) void reply.header('cache-control', 'no-store');
    return payload;
  });

  const auth = new AuthService(new AuthRepository(dataSource), {
    sessionTtlMs: authOptions.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS,
    passwordCost: authOptions.passwordCost,
    now: authOptions.now,
  });
  const requireAuth = createRequireAuth(app, auth);

  // Public: liveness and the sign-up / login endpoints (logout and /me require a session).
  void app.register(healthRoutes(dataSource));
  void app.register(authRoutes(auth, requireAuth), { prefix: '/api/v1/auth' });

  // Everything else needs a valid session; handlers use the session's student, never the body's.
  void app.register(
    async (api) => {
      api.addHook('onRequest', requireAuth);
      await api.register(quizRoutes(new QuizService(new QuizRepository(dataSource))));
      await api.register(attemptRoutes(new AttemptService(new AttemptRepository(dataSource))));
      await api.register(
        recommendationRoutes(new RecommendationService(new RecommendationRepository(dataSource))),
      );
      await api.register(
        explanationRoutes(
          new ExplanationService(
            new ExplanationRepository(dataSource),
            explanationProvider,
            aiTimeoutMs,
            aiLimits,
          ),
        ),
      );
      await api.register(
        doubtRoutes(
          new DoubtService(
            new DoubtRepository(dataSource),
            new ExplanationRepository(dataSource),
            explanationProvider,
            aiTimeoutMs,
            aiLimits,
          ),
        ),
      );
      await api.register(
        reviewRoutes(
          new ReviewService(
            new RecommendationRepository(dataSource),
            new ReviewRepository(dataSource),
            new QuizRepository(dataSource),
          ),
        ),
      );
    },
    { prefix: '/api/v1' },
  );
  return app;
}
