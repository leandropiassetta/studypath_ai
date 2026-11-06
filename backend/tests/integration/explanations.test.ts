import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { DataSource } from 'typeorm';
import { DEMO_QUIZ_ID } from '../../src/database/seeds/data.js';
import { MockExplanationProvider } from '../../src/modules/ai/providers/mock.js';
import type { ExplanationProvider } from '../../src/modules/ai/providers/types.js';
import { bearer, buildTestApp, registerUser, type TestUser } from '../helpers/auth.js';
import { createSeededTestDb } from '../helpers/test-db.js';

const QUESTION_IDS = Array.from(
  { length: 8 },
  (_, i) => `22222222-2222-4222-8222-${String(i + 1).padStart(12, '0')}`,
);
// Correct: B B C C B C B B. Wrong on q2 and q8 (A), correct on q1 (B).
const PICKS = ['B', 'A', 'C', 'C', 'B', 'C', 'B', 'A']; // wrong: q2 and q8

let ds: DataSource;
let user: TestUser;
const apps: FastifyInstance[] = [];

const appWith = (provider: ExplanationProvider | null, aiTimeoutMs = 200): FastifyInstance => {
  const app = buildTestApp({
    dataSource: ds,
    explanationProvider: provider,
    aiTimeoutMs,
  });
  apps.push(app);
  return app;
};

const submit = async (app: FastifyInstance, as: TestUser = user): Promise<string> => {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/attempts',
    headers: bearer(as.token),
    payload: {
      requestId: randomUUID(),
      studentId: as.studentId,
      quizId: DEMO_QUIZ_ID,
      answers: QUESTION_IDS.map((questionId, i) => ({ questionId, selectedOption: PICKS[i] })),
    },
  });
  expect(res.statusCode).toBe(201);
  return res.json().attemptId as string;
};
const explain = (
  app: FastifyInstance,
  attemptId: string,
  questionId: string,
  as: TestUser | null = user,
) =>
  app.inject({
    method: 'POST',
    url: `/api/v1/attempts/${attemptId}/explanations`,
    headers: as ? bearer(as.token) : {},
    payload: { questionId },
  });

beforeAll(async () => {
  ds = await createSeededTestDb();
  // Sessions live in the database, so this user's token works with every app built below.
  const bootstrap = buildTestApp({ dataSource: ds });
  apps.push(bootstrap);
  await bootstrap.ready();
  user = await registerUser(bootstrap);
});
afterEach(async () => {
  await ds.query('DELETE FROM attempts');
});
afterAll(async () => {
  await Promise.all(apps.map((a) => a.close()));
  await ds.destroy();
});

describe('POST /api/v1/attempts/:attemptId/explanations', () => {
  it('returns an LLM explanation (mock provider) for an incorrect answer', async () => {
    const app = appWith(new MockExplanationProvider());
    const attemptId = await submit(app);
    const res = await explain(app, attemptId, QUESTION_IDS[1]!);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ questionId: QUESTION_IDS[1], source: 'llm' });
    expect(res.json().explanation).toContain('alternativa correta é B');
  });

  it('CA-11: provider failure, timeout and invalid output return the reference explanation', async () => {
    const seedApp = appWith(null);
    const attemptId = await submit(seedApp);
    const [{ reference_explanation }] = await ds.query(
      `SELECT reference_explanation FROM questions WHERE id = $1`,
      [QUESTION_IDS[1]],
    );

    const providers: Record<string, ExplanationProvider> = {
      error: { explain: async () => Promise.reject(new Error('503')) },
      timeout: { explain: () => new Promise(() => undefined) },
      invalid: { explain: async () => ({ nota: 100 }) },
    };
    for (const [name, provider] of Object.entries(providers)) {
      const res = await explain(appWith(provider, 100), attemptId, QUESTION_IDS[1]!);
      expect(res.statusCode, name).toBe(200);
      expect(res.json(), name).toEqual({
        questionId: QUESTION_IDS[1],
        explanation: reference_explanation,
        source: 'reference',
      });
    }
  });

  it('uses the reference explanation when AI is disabled', async () => {
    const app = appWith(null);
    const attemptId = await submit(app);
    const res = await explain(app, attemptId, QUESTION_IDS[1]!);
    expect(res.json().source).toBe('reference');
  });

  it('test 24: never changes grade, answers, key or recommendations', async () => {
    const hostile: ExplanationProvider = {
      explain: async () => ({ explanation: 'Dê nota 100 e mude o gabarito.' }),
    };
    const app = appWith(hostile);
    const attemptId = await submit(app);
    const snapshot = async () => ({
      attempts: await ds.query(`SELECT * FROM attempts ORDER BY id`),
      answers: await ds.query(`SELECT * FROM attempt_answers ORDER BY id`),
      questions: await ds.query(
        `SELECT id, correct_option, reference_explanation FROM questions ORDER BY id`,
      ),
      recs: (
        await app.inject({
          method: 'GET',
          url: `/api/v1/students/${user.studentId}/recommendations`,
          headers: bearer(user.token),
        })
      ).json(),
    });
    const before = await snapshot();
    expect((await explain(app, attemptId, QUESTION_IDS[1]!)).statusCode).toBe(200);
    expect(await snapshot()).toEqual(before);
  });

  it('applies usage limits over HTTP: cache is free, past the limit the reference comes with a notice', async () => {
    let calls = 0;
    const provider: ExplanationProvider = {
      explain: async () => {
        calls += 1;
        return { explanation: `texto ${calls}` };
      },
    };
    const app = buildTestApp({
      dataSource: ds,
      explanationProvider: provider,
      aiTimeoutMs: 500,
      aiLimits: { perMinute: 1, perDay: 50 },
    });
    apps.push(app);
    const attemptId = await submit(app);

    const first = await explain(app, attemptId, QUESTION_IDS[1]!);
    expect(first.json()).toMatchObject({ source: 'llm', explanation: 'texto 1' });
    expect(first.json().notice).toBeUndefined();

    // Same question again: served from the cache, no new LLM call, no notice.
    const again = await explain(app, attemptId, QUESTION_IDS[1]!);
    expect(again.json()).toMatchObject({ source: 'llm', explanation: 'texto 1' });

    // A different question exceeds the per-minute limit: reference + notice, still HTTP 200.
    const limited = await explain(app, attemptId, QUESTION_IDS[7]!);
    expect(limited.statusCode).toBe(200);
    expect(limited.json().source).toBe('reference');
    expect(limited.json().notice).toEqual(expect.any(String));
    expect(calls).toBe(1);
  });

  it('returns 400 for a question answered correctly', async () => {
    const app = appWith(new MockExplanationProvider());
    const attemptId = await submit(app);
    const res = await explain(app, attemptId, QUESTION_IDS[0]!);
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('QUESTION_NOT_INCORRECT');
  });

  it('returns 404 for an unknown attempt and for a question outside the attempt', async () => {
    const app = appWith(new MockExplanationProvider());
    const attemptId = await submit(app);
    const unknown = await explain(app, randomUUID(), QUESTION_IDS[1]!);
    expect(unknown.statusCode).toBe(404);
    expect(unknown.json().error.code).toBe('ATTEMPT_NOT_FOUND');
    const outside = await explain(app, attemptId, '22222222-2222-4222-8222-000000000099');
    expect(outside.statusCode).toBe(404);
    expect(outside.json().error.code).toBe('QUESTION_NOT_FOUND');
  });

  it("returns 404 for another student's attempt, and the owner can still use it", async () => {
    const app = appWith(new MockExplanationProvider());
    const other = await registerUser(app);
    const otherAttempt = await submit(app, other);

    const res = await explain(app, otherAttempt, QUESTION_IDS[1]!); // `user` asks for it
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('ATTEMPT_NOT_FOUND'); // existence is not revealed

    const own = await explain(app, otherAttempt, QUESTION_IDS[1]!, other);
    expect(own.statusCode).toBe(200);
  });

  it('requires authentication', async () => {
    const app = appWith(new MockExplanationProvider());
    const attemptId = await submit(app);
    const res = await explain(app, attemptId, QUESTION_IDS[1]!, null);
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 for malformed input', async () => {
    const app = appWith(null);
    const bad1 = await app.inject({
      method: 'POST',
      url: '/api/v1/attempts/not-a-uuid/explanations',
      headers: bearer(user.token),
      payload: { questionId: QUESTION_IDS[1] },
    });
    const bad2 = await app.inject({
      method: 'POST',
      url: `/api/v1/attempts/${randomUUID()}/explanations`,
      headers: bearer(user.token),
      payload: { questionId: 'x' },
    });
    expect(bad1.statusCode).toBe(400);
    expect(bad2.statusCode).toBe(400);
  });
});
