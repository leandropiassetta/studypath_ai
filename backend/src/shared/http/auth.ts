import type { FastifyInstance, FastifyRequest, onRequestAsyncHookHandler } from 'fastify';
import { AppError } from '../errors/app-error.js';
import type { AuthContext, AuthService } from '../../modules/auth/service.js';

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext | null;
  }
}

const BEARER = /^Bearer ([A-Za-z0-9_-]{20,128})$/;

const unauthenticated = (): AppError =>
  new AppError(401, 'UNAUTHENTICATED', 'Faça login para continuar', [], {
    'www-authenticate': 'Bearer',
  });

/** Adds `req.auth` and returns the hook that makes a route group require a valid session. */
export function createRequireAuth(
  app: FastifyInstance,
  auth: AuthService,
): onRequestAsyncHookHandler {
  app.decorateRequest('auth', null);
  return async (req) => {
    const match = BEARER.exec(req.headers.authorization ?? '');
    const ctx = match ? await auth.authenticate(match[1] as string) : null;
    if (!ctx) throw unauthenticated();
    req.auth = ctx;
  };
}

/** Hook for routes only teachers may use. Students get 403, so the teacher area stays closed to them. */
export const requireTeacher: onRequestAsyncHookHandler = async (req) => {
  if (getAuth(req).role !== 'teacher') {
    throw new AppError(403, 'FORBIDDEN', 'Área exclusiva de professores');
  }
};

/** The authenticated session of a request that went through `requireAuth`. */
export function getAuth(req: FastifyRequest): AuthContext {
  if (!req.auth) throw unauthenticated();
  return req.auth;
}
