import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { DataSource } from 'typeorm';
import { asUser, buildTestApp, registerUser } from '../helpers/auth.js';
import { createSeededTestDb } from '../helpers/test-db.js';

let ds: DataSource;
let app: FastifyInstance;

beforeAll(async () => {
  ds = await createSeededTestDb();
  app = buildTestApp({ dataSource: ds });
});
afterAll(async () => {
  await app.close();
  await ds.destroy();
});

describe('GET /api/v1/quizzes', () => {
  it('requires login', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/v1/quizzes' })).statusCode).toBe(401);
  });

  it('lists one simulado per subject with its topics and size, without answer keys', async () => {
    const user = await registerUser(app);
    const res = await asUser(app, user.token).inject({ method: 'GET', url: '/api/v1/quizzes' });
    expect(res.statusCode).toBe(200);
    const list = res.json() as {
      slug: string;
      questionCount: number;
      topics: { name: string }[];
    }[];
    expect(list.map((q) => q.slug).sort()).toEqual([
      'demo-ciencias',
      'demo-geografia',
      'demo-historia',
      'demo-ingles',
      'demo-matematica',
      'demo-portugues',
    ]);
    const math = list.find((q) => q.slug === 'demo-matematica')!;
    expect(math.questionCount).toBe(8);
    expect(math.topics.map((t) => t.name)).toEqual(['Equações', 'Geometria']);
    const hist = list.find((q) => q.slug === 'demo-historia')!;
    expect(hist).toMatchObject({
      questionCount: 8,
      topics: [{ name: 'História do Brasil' }, { name: 'História Geral' }],
    });
    expect(res.body).not.toMatch(/correct/i);
  });

  it('does not list review quizzes', async () => {
    await ds.query(
      `INSERT INTO quizzes (slug, title, kind, is_active) VALUES ('revisao-teste-lista', 'Revisão', 'review', true)`,
    );
    const user = await registerUser(app);
    const res = await asUser(app, user.token).inject({ method: 'GET', url: '/api/v1/quizzes' });
    expect((res.json() as { slug: string }[]).some((q) => q.slug.startsWith('revisao'))).toBe(
      false,
    );
  });

  it('each new simulado can be fetched and has 8 questions, 4 per subtopic', async () => {
    const user = await registerUser(app);
    for (const slug of [
      'demo-geografia',
      'demo-historia',
      'demo-ingles',
      'demo-ciencias',
      'demo-portugues',
    ]) {
      const res = await asUser(app, user.token).inject({
        method: 'GET',
        url: `/api/v1/quizzes/${slug}`,
      });
      expect(res.statusCode).toBe(200);
      const quiz = res.json();
      expect(quiz.questions).toHaveLength(8);
      const names = quiz.questions.map((q: { topic: { name: string } }) => q.topic.name);
      expect(new Set(names).size).toBe(2);
      // The first subtopic fills positions 1-4 and the second 5-8, like math.
      expect(new Set(names.slice(0, 4)).size).toBe(1);
      expect(new Set(names.slice(4)).size).toBe(1);
    }
  });
});
