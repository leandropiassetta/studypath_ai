import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { DataSource } from 'typeorm';
import { buildTestApp } from '../helpers/auth.js';
import { createSeededTestDb } from '../helpers/test-db.js';

let ds: DataSource;
let app: FastifyInstance;

beforeAll(async () => {
  ds = await createSeededTestDb();
  app = buildTestApp({ dataSource: ds });
  await app.ready();
});
afterAll(async () => {
  await app.close();
  await ds.destroy();
});

describe('CORS (loopback only)', () => {
  it('answers preflight for a loopback origin', async () => {
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/api/v1/attempts',
      headers: { origin: 'http://localhost:5555', 'access-control-request-method': 'POST' },
    });
    expect(res.statusCode).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5555');
    expect(res.headers['access-control-allow-methods']).toContain('POST');
    // The app sends the bearer token in this header, so the preflight must allow it.
    expect(res.headers['access-control-allow-headers']).toContain('authorization');
  });

  it('allows every method the app uses from the browser, including PUT ("Isso ajudou?")', async () => {
    for (const method of ['GET', 'POST', 'PUT']) {
      const res = await app.inject({
        method: 'OPTIONS',
        url: '/api/v1/doubts/00000000-0000-4000-8000-000000000000/feedback',
        headers: { origin: 'http://localhost:5555', 'access-control-request-method': method },
      });
      expect(res.statusCode).toBe(204);
      expect(res.headers['access-control-allow-methods'], method).toContain(method);
    }
  });

  it('adds the allow-origin header on normal responses', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'http://127.0.0.1:8080' },
    });
    expect(res.headers['access-control-allow-origin']).toBe('http://127.0.0.1:8080');
  });

  it('does not allow foreign origins', async () => {
    for (const origin of [
      'https://evil.example',
      'http://localhost.evil.example',
      'http://evil.com:3000',
    ]) {
      const res = await app.inject({ method: 'GET', url: '/health', headers: { origin } });
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
      const pre = await app.inject({
        method: 'OPTIONS',
        url: '/api/v1/attempts',
        headers: { origin },
      });
      expect(pre.headers['access-control-allow-origin']).toBeUndefined();
    }
  });
});

describe('CORS for a deployed app', () => {
  const PAGES = 'https://usuario.github.io';
  let deployed: FastifyInstance;
  beforeAll(async () => {
    deployed = buildTestApp({ dataSource: ds, allowedOrigins: [PAGES] });
    await deployed.ready();
  });
  afterAll(async () => {
    await deployed.close();
  });

  const preflight = (origin: string) =>
    deployed.inject({
      method: 'OPTIONS',
      url: '/api/v1/auth/login',
      headers: { origin, 'access-control-request-method': 'POST' },
    });

  it('allows exactly the listed origin, and localhost keeps working', async () => {
    expect((await preflight(PAGES)).headers['access-control-allow-origin']).toBe(PAGES);
    expect((await preflight('http://localhost:5555')).headers['access-control-allow-origin']).toBe(
      'http://localhost:5555',
    );
  });

  it('refuses look-alikes: another user, another scheme, a subdomain, a path, a wildcard', async () => {
    for (const origin of [
      'https://outro.github.io',
      'http://usuario.github.io',
      'https://usuario.github.io.evil.example',
      'https://evil.usuario.github.io',
      `${PAGES}/studypath_ai`,
      '*',
      'null',
    ]) {
      const res = await preflight(origin);
      expect(res.headers['access-control-allow-origin'], origin).toBeUndefined();
    }
  });

  it('the default app (no list) still refuses the same address', async () => {
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/api/v1/auth/login',
      headers: { origin: PAGES, 'access-control-request-method': 'POST' },
    });
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
