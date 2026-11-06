import type { FastifyInstance } from 'fastify';

// Loopback origins are always allowed (e.g. Flutter web served by `flutter run -d chrome`).
// Anything else must be listed explicitly: there is no wildcard, so the API is never callable
// from arbitrary sites, even when it is deployed publicly.
const LOOPBACK_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export function registerCors(app: FastifyInstance, allowedOrigins: readonly string[] = []): void {
  const allowed = new Set(allowedOrigins);
  app.addHook('onRequest', async (req, reply) => {
    const origin = req.headers.origin;
    if (origin === undefined || !(LOOPBACK_ORIGIN.test(origin) || allowed.has(origin))) return;

    void reply.header('access-control-allow-origin', origin);
    void reply.header('vary', 'Origin');
    if (req.method === 'OPTIONS') {
      void reply
        .header('access-control-allow-methods', 'GET, POST, PUT, OPTIONS')
        .header('access-control-allow-headers', 'content-type, authorization')
        .header('access-control-max-age', '600')
        .status(204)
        .send();
    }
  });
}
