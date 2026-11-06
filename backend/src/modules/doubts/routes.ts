import type { FastifyPluginAsync } from 'fastify';
import type { Static } from '@sinclair/typebox';
import { getAuth } from '../../shared/http/auth.js';
import {
  CreateDoubtBody,
  DoubtParams,
  DoubtResponse,
  HintResponse,
  type CreateDoubtInput,
} from './schemas.js';
import type { DoubtService } from './service.js';

export const doubtRoutes =
  (service: DoubtService): FastifyPluginAsync =>
  async (app) => {
    app.post<{ Body: CreateDoubtInput }>(
      '/doubts',
      { schema: { body: CreateDoubtBody, response: { 200: DoubtResponse, 201: DoubtResponse } } },
      async (req, reply) => {
        const { doubt, created } = await service.open(getAuth(req).studentId, req.body);
        return reply.status(created ? 201 : 200).send(doubt);
      },
    );

    app.get<{ Params: Static<typeof DoubtParams> }>(
      '/doubts/:doubtId',
      { schema: { params: DoubtParams, response: { 200: DoubtResponse } } },
      (req) => service.get(getAuth(req).studentId, req.params.doubtId),
    );

    app.post<{ Params: Static<typeof DoubtParams> }>(
      '/doubts/:doubtId/hints',
      { schema: { params: DoubtParams, response: { 200: HintResponse } } },
      (req) => service.nextHint(getAuth(req).studentId, req.params.doubtId, req.log),
    );
  };
