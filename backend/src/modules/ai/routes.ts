import type { FastifyPluginAsync } from 'fastify';
import type { Static } from '@sinclair/typebox';
import { getAuth } from '../../shared/http/auth.js';
import type { ExplanationService } from './service.js';
import {
  ExplanationBody,
  ExplanationParams,
  ExplanationResponse,
  type ExplanationRequest,
} from './schemas.js';

export const explanationRoutes =
  (service: ExplanationService): FastifyPluginAsync =>
  async (app) => {
    app.post<{ Params: Static<typeof ExplanationParams>; Body: ExplanationRequest }>(
      '/attempts/:attemptId/explanations',
      {
        schema: {
          params: ExplanationParams,
          body: ExplanationBody,
          response: { 200: ExplanationResponse },
        },
      },
      (req) =>
        service.explain(getAuth(req).studentId, req.params.attemptId, req.body.questionId, req.log),
    );
  };
