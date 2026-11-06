import type { FastifyPluginAsync } from 'fastify';
import type { Static } from '@sinclair/typebox';
import { getAuth } from '../../shared/http/auth.js';
import type { RecommendationService } from './service.js';
import { RecommendationsResponse, StudentParams } from './schemas.js';

export const recommendationRoutes =
  (service: RecommendationService): FastifyPluginAsync =>
  async (app) => {
    app.get<{ Params: Static<typeof StudentParams> }>(
      '/students/:studentId/recommendations',
      { schema: { params: StudentParams, response: { 200: RecommendationsResponse } } },
      (req) => service.getFor(getAuth(req).studentId, req.params.studentId),
    );
  };
