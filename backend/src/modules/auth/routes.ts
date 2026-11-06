import type { FastifyPluginAsync, onRequestAsyncHookHandler } from 'fastify';
import { getAuth } from '../../shared/http/auth.js';
import {
  AuthResponse,
  LoginBody,
  RegisterBody,
  StudentResponse,
  type LoginInput,
  type RegisterInput,
} from './schemas.js';
import type { AuthService } from './service.js';

export const authRoutes =
  (service: AuthService, requireAuth: onRequestAsyncHookHandler): FastifyPluginAsync =>
  async (app) => {
    app.post<{ Body: RegisterInput }>(
      '/register',
      { schema: { body: RegisterBody, response: { 201: AuthResponse } } },
      async (req, reply) => reply.status(201).send(await service.register(req.body, req.ip)),
    );

    app.post<{ Body: LoginInput }>(
      '/login',
      { schema: { body: LoginBody, response: { 200: AuthResponse } } },
      (req) => service.login(req.body, req.ip),
    );

    app.post('/logout', { onRequest: requireAuth }, async (req, reply) => {
      await service.logout(getAuth(req));
      return reply.status(204).send();
    });

    app.get(
      '/me',
      { onRequest: requireAuth, schema: { response: { 200: StudentResponse } } },
      (req) => service.me(getAuth(req)),
    );
  };
