import type { FastifyPluginAsync } from 'fastify';
import type { Static } from '@sinclair/typebox';
import { getAuth } from '../../shared/http/auth.js';
import type { RecommendationService } from './service.js';
import { RecommendationsQuery, RecommendationsResponse, StudentParams } from './schemas.js';

export const recommendationRoutes =
  (service: RecommendationService): FastifyPluginAsync =>
  async (app) => {
    app.get<{
      Params: Static<typeof StudentParams>;
      Querystring: Static<typeof RecommendationsQuery>;
    }>(
      '/students/:studentId/recommendations',
      {
        schema: {
          params: StudentParams,
          querystring: RecommendationsQuery,
          response: { 200: RecommendationsResponse },
        },
      },
      (req) => service.getFor(getAuth(req).studentId, req.params.studentId, req.query.quiz),
    );
  };
