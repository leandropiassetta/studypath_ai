import type { FastifyPluginAsync } from 'fastify';
import type { Static } from '@sinclair/typebox';
import { getAuth } from '../../shared/http/auth.js';
import {
  CreateDoubtBody,
  DoubtParams,
  DoubtResponse,
  FeedbackBody,
  HintResponse,
  TeacherAnswerBody,
  TeacherQueueQuery,
  TeacherQueueResponse,
  type CreateDoubtInput,
  type FeedbackInput,
  type TeacherAnswerInput,
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

    app.post<{ Params: Static<typeof DoubtParams> }>(
      '/doubts/:doubtId/teacher',
      { schema: { params: DoubtParams, response: { 200: DoubtResponse } } },
      (req) => service.requestTeacher(getAuth(req).studentId, req.params.doubtId),
    );

    app.put<{ Params: Static<typeof DoubtParams>; Body: FeedbackInput }>(
      '/doubts/:doubtId/feedback',
      { schema: { params: DoubtParams, body: FeedbackBody, response: { 200: DoubtResponse } } },
      (req) => service.sendFeedback(getAuth(req).studentId, req.params.doubtId, req.body),
    );
  };

/** Teacher area: registered behind both the login and the teacher-role hook (see app.ts). */
export const teacherRoutes =
  (service: DoubtService): FastifyPluginAsync =>
  async (app) => {
    app.get<{ Querystring: Static<typeof TeacherQueueQuery> }>(
      '/doubts',
      { schema: { querystring: TeacherQueueQuery, response: { 200: TeacherQueueResponse } } },
      (req) => service.teacherQueue(getAuth(req).studentId, req.query.status ?? 'waiting'),
    );

    app.post<{ Params: Static<typeof DoubtParams>; Body: TeacherAnswerInput }>(
      '/doubts/:doubtId/answer',
      { schema: { params: DoubtParams, body: TeacherAnswerBody } },
      async (req, reply) => {
        await service.teacherAnswer(getAuth(req).studentId, req.params.doubtId, req.body.answer);
        return reply.status(204).send();
      },
    );
  };
