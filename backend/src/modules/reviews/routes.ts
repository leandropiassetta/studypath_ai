import type { FastifyPluginAsync } from 'fastify';
import type { Static } from '@sinclair/typebox';
import { getAuth } from '../../shared/http/auth.js';
import type { ReviewService } from './service.js';
import { ReviewBody, ReviewParams, ReviewQuizResponse, type ReviewRequest } from './schemas.js';

export const reviewRoutes =
  (service: ReviewService): FastifyPluginAsync =>
  async (app) => {
    app.post<{ Params: Static<typeof ReviewParams>; Body: ReviewRequest }>(
      '/students/:studentId/review-quizzes',
      {
        schema: {
          params: ReviewParams,
          body: ReviewBody,
          response: { 200: ReviewQuizResponse },
        },
      },
      (req) =>
        service.createForTopic(getAuth(req).studentId, req.params.studentId, req.body.topicId),
    );
  };
