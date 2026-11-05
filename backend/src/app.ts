import Fastify, { type FastifyInstance } from 'fastify';

export function buildApp(options: { logger?: boolean } = {}): FastifyInstance {
  return Fastify({ logger: options.logger ?? false });
}
