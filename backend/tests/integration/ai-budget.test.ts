import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { DataSource } from 'typeorm';
import { DEMO_QUIZ_ID } from '../../src/database/seeds/data.js';
import { MockExplanationProvider } from '../../src/modules/ai/providers/mock.js';
import { UsageLimiter } from '../../src/modules/ai/usage.js';
import { asUser, buildTestApp, registerUser, type TestUser } from '../helpers/auth.js';
import { createSeededTestDb } from '../helpers/test-db.js';

const QUESTION_IDS = Array.from(
  { length: 8 },
  (_, i) => `22222222-2222-4222-8222-${String(i + 1).padStart(12, '0')}`,
);
// Wrong on q2 and q8.
const PICKS = ['B', 'A', 'C', 'C', 'B', 'C', 'B', 'A'];

let ds: DataSource;
let app: FastifyInstance;
let user: TestUser;
let aiUsage: UsageLimiter;

beforeAll(async () => {
  ds = await createSeededTestDb();
  // 3 AI calls per minute for the WHOLE app, whichever feature spends them.
  aiUsage = new UsageLimiter({ perMinute: 3, perDay: 50 });
  app = buildTestApp({
    dataSource: ds,
    explanationProvider: new MockExplanationProvider(),
    aiUsage,
  });
  await app.ready();
  user = await registerUser(app);
});
afterAll(async () => {
  await app.close();
  await ds.destroy();
});

describe('one AI budget per student, shared by every feature', () => {
  it('explanations, hints and the background analysis draw from the same allowance', async () => {
    const client = asUser(app, user.token);
    const attempt = await client.inject({
      method: 'POST',
      url: '/api/v1/attempts',
      payload: {
        requestId: randomUUID(),
        studentId: user.studentId,
        quizId: DEMO_QUIZ_ID,
        answers: QUESTION_IDS.map((questionId, i) => ({ questionId, selectedOption: PICKS[i] })),
      },
    });
    const attemptId = attempt.json().attemptId as string;

    const explain = (questionId: string) =>
      client.inject({
        method: 'POST',
        url: `/api/v1/attempts/${attemptId}/explanations`,
        payload: { questionId },
      });
    // 1st and 2nd call: two explanations (different questions, so the cache does not help).
    expect((await explain(QUESTION_IDS[1]!)).json().source).toBe('llm');
    expect((await explain(QUESTION_IDS[7]!)).json().source).toBe('llm');

    // 3rd call: a hint. Still inside the budget of 3.
    const doubt = (
      await client.inject({
        method: 'POST',
        url: '/api/v1/doubts',
        payload: { attemptId, questionId: QUESTION_IDS[1] },
      })
    ).json();
    const hint = () =>
      client.inject({ method: 'POST', url: `/api/v1/doubts/${doubt.id}/hints`, payload: {} });
    expect((await hint()).json().source).toBe('llm');

    // The allowance is spent: the next AI hint falls back, with the notice.
    const limited = (await hint()).json();
    expect(limited).toMatchObject({ level: 2, source: 'reference' });
    expect(limited.notice).toEqual(expect.any(String));

    // And so does a new explanation (a different feature, the same student).
    const another = (await explain(QUESTION_IDS[1]!)).json(); // cached: free
    expect(another.source).toBe('llm');
    expect(aiUsage.tryAcquire(user.studentId)).not.toBe('ok'); // the analysis job is limited too
  });

  it('another student has their own allowance', async () => {
    expect(aiUsage.tryAcquire('someone-else')).toBe('ok');
  });
});
