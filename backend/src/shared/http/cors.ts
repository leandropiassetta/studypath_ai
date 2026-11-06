import type { FastifyInstance } from 'fastify';

// Loopback origins only (e.g. Flutter web served by `flutter run -d chrome`).
// No wildcard: the demo API must never be callable from arbitrary sites.
const LOOPBACK_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export function registerLoopbackCors(app: FastifyInstance): void {
  app.addHook('onRequest', async (req, reply) => {
    const origin = req.headers.origin;
    if (origin === undefined || !LOOPBACK_ORIGIN.test(origin)) return;

    void reply.header('access-control-allow-origin', origin);
    void reply.header('vary', 'Origin');
    if (req.method === 'OPTIONS') {
      void reply
        .header('access-control-allow-methods', 'GET, POST, OPTIONS')
        .header('access-control-allow-headers', 'content-type, authorization')
        .header('access-control-max-age', '600')
        .status(204)
        .send();
    }
  });
}
