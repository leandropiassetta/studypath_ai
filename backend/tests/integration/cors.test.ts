import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { DataSource } from 'typeorm';
import { buildApp } from '../../src/app.js';
import { DEMO_STUDENT_ID } from '../../src/database/seeds/data.js';
import { createSeededTestDb } from '../helpers/test-db.js';

let ds: DataSource;
let app: FastifyInstance;

beforeAll(async () => {
  ds = await createSeededTestDb();
  app = buildApp({ dataSource: ds, demoStudentId: DEMO_STUDENT_ID });
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
