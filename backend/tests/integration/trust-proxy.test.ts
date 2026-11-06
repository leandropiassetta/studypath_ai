import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { DataSource } from 'typeorm';
import { buildTestApp, TEST_PASSWORD } from '../helpers/auth.js';
import { createSeededTestDb } from '../helpers/test-db.js';

let ds: DataSource;
const apps: FastifyInstance[] = [];

beforeAll(async () => {
  ds = await createSeededTestDb();
});
afterAll(async () => {
  await Promise.all(apps.map((a) => a.close()));
  await ds.destroy();
});

const make = async (trustProxy?: number) => {
  const app = buildTestApp({ dataSource: ds, ...(trustProxy === undefined ? {} : { trustProxy }) });
  apps.push(app);
  await app.ready();
  return app;
};

/** Five wrong logins for the same e-mail from the same client address use up the allowance. */
const wrongLogin = (app: FastifyInstance, forwardedFor?: string) =>
  app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    remoteAddress: '10.9.9.9', // the proxy, or the user when there is no proxy
    headers: forwardedFor ? { 'x-forwarded-for': forwardedFor } : {},
    payload: { email: 'alguem@teste.dev', password: `${TEST_PASSWORD}-errada` },
  });
const exhaust = async (app: FastifyInstance, forwardedFor?: string) => {
  for (let i = 0; i < 5; i++) expect((await wrongLogin(app, forwardedFor)).statusCode).toBe(401);
};

describe('per-IP limits behind a reverse proxy', () => {
  it('with one trusted proxy, each real client has its own allowance', async () => {
    const app = await make(1);
    await exhaust(app, '203.0.113.1');
    expect((await wrongLogin(app, '203.0.113.1')).statusCode).toBe(429); // this client is blocked
    expect((await wrongLogin(app, '203.0.113.2')).statusCode).toBe(401); // another one is not
  });

  it('the address a client puts at the START of X-Forwarded-For is ignored', async () => {
    const app = await make(1);
    await exhaust(app, '198.51.100.7'); // the real client, as the proxy saw it
    // The same client tries to dodge the block by inventing a leading address.
    expect((await wrongLogin(app, '1.2.3.4, 198.51.100.7')).statusCode).toBe(429);
  });

  it('without a configured proxy the header is not believed at all', async () => {
    const app = await make(); // trustProxy = 0
    await exhaust(app, '203.0.113.1');
    // A different forged address does not give a fresh allowance.
    expect((await wrongLogin(app, '203.0.113.99')).statusCode).toBe(429);
    expect((await wrongLogin(app)).statusCode).toBe(429);
  });
});
