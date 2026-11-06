import type { FastifyPluginAsync } from 'fastify';
import type { Static } from '@sinclair/typebox';
import type { QuizService } from './service.js';
import { QuizListResponse, QuizParams, QuizResponse } from './schemas.js';

export const quizRoutes =
  (service: QuizService): FastifyPluginAsync =>
  async (app) => {
    app.get('/quizzes', { schema: { response: { 200: QuizListResponse } } }, () => service.list());

    app.get<{ Params: Static<typeof QuizParams> }>(
      '/quizzes/:slug',
      { schema: { params: QuizParams, response: { 200: QuizResponse } } },
      (req) => service.getBySlug(req.params.slug),
    );
  };
