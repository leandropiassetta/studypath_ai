import type { FastifyPluginAsync } from 'fastify';
import type { AttemptService } from './service.js';
import { AttemptResponse, CreateAttemptBody, type CreateAttemptInput } from './schemas.js';

export const attemptRoutes =
  (service: AttemptService): FastifyPluginAsync =>
  async (app) => {
    app.post<{ Body: CreateAttemptInput }>(
      '/attempts',
      {
        schema: {
          body: CreateAttemptBody,
          response: { 200: AttemptResponse, 201: AttemptResponse },
        },
      },
      async (req, reply) => {
        const { created, result } = await service.submit(req.body);
        return reply.status(created ? 201 : 200).send(result);
      },
    );
  };
