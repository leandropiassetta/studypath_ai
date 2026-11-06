import type { FastifyError, FastifyInstance } from 'fastify';
import { AppError } from './app-error.js';

export interface ErrorBody {
  error: { code: string; message: string; details: unknown[] };
}

const body = (code: string, message: string, details: unknown[] = []): ErrorBody => ({
  error: { code, message, details },
});

/** Standard error envelope for every failure. 500s never leak internals to the client. */
export function registerErrorHandling(app: FastifyInstance): void {
  app.setNotFoundHandler((_req, reply) => {
    void reply.status(404).send(body('NOT_FOUND', 'Recurso não encontrado'));
  });

  app.setErrorHandler((err: FastifyError | AppError, req, reply) => {
    if (err instanceof AppError) {
      for (const [name, value] of Object.entries(err.headers)) void reply.header(name, value);
      return reply.status(err.statusCode).send(body(err.code, err.message, err.details));
    }
    if ('validation' in err && err.validation) {
      const details = err.validation.map((v) => ({ path: v.instancePath, message: v.message }));
      return reply.status(400).send(body('INVALID_REQUEST', 'Requisição inválida', details));
    }
    const status = 'statusCode' in err ? err.statusCode : undefined;
    if (status !== undefined && status >= 400 && status < 500) {
      return reply.status(status).send(body('INVALID_REQUEST', 'Requisição inválida'));
    }
    req.log.error({ err }, 'unhandled error');
    return reply.status(500).send(body('INTERNAL_ERROR', 'Erro interno'));
  });
}
