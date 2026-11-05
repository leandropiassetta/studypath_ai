import type { FastifyPluginAsync } from 'fastify';
import type { DataSource } from 'typeorm';

export const healthRoutes =
  (ds: DataSource): FastifyPluginAsync =>
  async (app) => {
    app.get('/health', async (req, reply) => {
      try {
        await ds.query('SELECT 1');
        return { status: 'ok' };
      } catch (err) {
        req.log.error({ err }, 'health check failed');
        return reply.status(503).send({ status: 'unavailable' });
      }
    });
  };
