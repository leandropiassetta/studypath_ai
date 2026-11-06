import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { DataSource } from 'typeorm';
import { buildApp } from '../../src/app.js';
import { createDataSource } from '../../src/database/data-source.js';
import { DEMO_STUDENT_ID } from '../../src/database/seeds/data.js';
import { createSeededTestDb, TEST_DATABASE_URL } from '../helpers/test-db.js';

let ds: DataSource;
let app: FastifyInstance;

beforeAll(async () => {
  ds = await createSeededTestDb();
  await ds.query(
    `INSERT INTO quizzes (slug, title, is_active) VALUES ('inativo', 'Simulado inativo', false)`,
  );
  app = buildApp({ dataSource: ds, demoStudentId: DEMO_STUDENT_ID });
  app.get('/__boom', () => {
    throw new Error('secret database detail');
  });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await ds.destroy();
});

describe('GET /api/v1/quizzes/:slug', () => {
  it('CA-01: returns 8 ordered questions without the answer key', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/quizzes/demo-matematica' });
    expect(res.statusCode).toBe(200);
    const quiz = res.json();
    expect(quiz.slug).toBe('demo-matematica');
    expect(quiz.questions).toHaveLength(8);
    expect(quiz.questions[0]).toEqual({
      id: '22222222-2222-4222-8222-000000000001',
      topic: { id: '33333333-3333-4333-8333-333333333333', name: 'Equações' },
      statement: 'Quanto é x se x + 2 = 5?',
      options: [
        { key: 'A', text: '2' },
        { key: 'B', text: '3' },
        { key: 'C', text: '5' },
      ],
      difficulty: 'easy',
    });
    expect(quiz.questions.map((q: { id: string }) => q.id)).toEqual(
      Array.from(
        { length: 8 },
        (_, i) => `22222222-2222-4222-8222-${String(i + 1).padStart(12, '0')}`,
      ),
    );
    expect(res.body).not.toMatch(/correct|explanation/i);
  });

  it('returns 404 for an unknown quiz', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/quizzes/nao-existe' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({
      error: { code: 'QUIZ_NOT_FOUND', message: 'Simulado não encontrado', details: [] },
    });
  });

  it('returns 404 for an inactive quiz', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/quizzes/inativo' });
    expect(res.statusCode).toBe(404);
  });

  it('returns 400 for a malformed slug', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/quizzes/Slug%20Inv%C3%A1lido' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('INVALID_REQUEST');
  });
});

describe('response hardening', () => {
  it('sends nosniff everywhere and no-store on API responses', async () => {
    const api = await app.inject({ method: 'GET', url: '/api/v1/quizzes/demo-matematica' });
    expect(api.headers['x-content-type-options']).toBe('nosniff');
    expect(api.headers['cache-control']).toBe('no-store');
    const health = await app.inject({ method: 'GET', url: '/health' });
    expect(health.headers['x-content-type-options']).toBe('nosniff');
  });

  it('rejects oversized request bodies with a client error', async () => {
    const huge = { requestId: 'x'.repeat(100_000) };
    const res = await app.inject({ method: 'POST', url: '/api/v1/attempts', payload: huge });
    expect(res.statusCode).toBe(413);
    expect(res.json().error.code).toBe('INVALID_REQUEST');
  });
});

describe('error handling', () => {
  it('uses the standard envelope for unknown routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/nada' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });

  it('hides internals on 500', async () => {
    const res = await app.inject({ method: 'GET', url: '/__boom' });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno', details: [] },
    });
    expect(res.body).not.toContain('secret');
  });
});

describe('GET /health', () => {
  it('returns 200 when the database is reachable', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('returns 503 without infrastructure details when the database is down', async () => {
    const closed = createDataSource(TEST_DATABASE_URL);
    await closed.initialize();
    await closed.destroy();
    const downApp = buildApp({ dataSource: closed, demoStudentId: DEMO_STUDENT_ID });
    const res = await downApp.inject({ method: 'GET', url: '/health' });
    await downApp.close();
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ status: 'unavailable' });
  });
});
