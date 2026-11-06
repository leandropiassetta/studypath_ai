import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { DataSource } from 'typeorm';
import { DEMO_QUIZ_ID } from '../../src/database/seeds/data.js';
import { asUser, buildTestApp, registerUser, type TestUser } from '../helpers/auth.js';
import { createSeededTestDb } from '../helpers/test-db.js';

const QUESTION_IDS = Array.from(
  { length: 8 },
  (_, i) => `22222222-2222-4222-8222-${String(i + 1).padStart(12, '0')}`,
);
const EQ = '33333333-3333-4333-8333-333333333333';
// Correct options by position: Equações B B C C | Geometria B C B B  (verified in attempts.test)
const CORRECT = ['B', 'B', 'C', 'C', 'B', 'C', 'B', 'B'];
// 1/4 Equações, 3/4 Geometria
const EQ_1_OF_4 = ['B', 'A', 'A', 'A', 'B', 'C', 'B', 'A'];
const ALL_WRONG = CORRECT.map((c) => (c === 'A' ? 'B' : 'A'));

let ds: DataSource;
let app: FastifyInstance;
let user: TestUser;
let client: ReturnType<typeof asUser>;

const submit = async (picks: string[]): Promise<void> => {
  const res = await client.inject({
    method: 'POST',
    url: '/api/v1/attempts',
    payload: {
      requestId: randomUUID(),
      studentId: user.studentId,
      quizId: DEMO_QUIZ_ID,
      answers: QUESTION_IDS.map((questionId, i) => ({ questionId, selectedOption: picks[i] })),
    },
  });
  expect(res.statusCode).toBe(201);
};
const recs = (studentId = user.studentId, query = '') =>
  client.inject({ method: 'GET', url: `/api/v1/students/${studentId}/recommendations${query}` });

beforeAll(async () => {
  ds = await createSeededTestDb();
  app = buildTestApp({ dataSource: ds });
  await app.ready();
  user = await registerUser(app);
  client = asUser(app, user.token);
});
afterEach(async () => {
  await ds.query('DELETE FROM attempts');
});
afterAll(async () => {
  await app.close();
  await ds.destroy();
});

describe('GET /api/v1/students/:studentId/recommendations', () => {
  it('CA-07: returns NO_HISTORY with an empty list when there are no attempts', async () => {
    const res = await recs();
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      studentId: user.studentId,
      status: 'NO_HISTORY',
      evaluatedAttempts: 0,
      subject: null,
      progressSubject: null,
      progress: [],
      topics: [],
    });
  });

  it('CA-06: 1/4 in Equações is HIGH with 3 unseen questions; 3/4 in Geometria is LOW, never HIGH', async () => {
    await submit(EQ_1_OF_4);
    const res = await recs();
    expect(res.statusCode).toBe(200);
    const out = res.json();
    expect(out.status).toBe('NEEDS_REVIEW');
    expect(out.evaluatedAttempts).toBe(1);
    expect(
      out.topics.map((t: { topicName: string; priority: string }) => [t.topicName, t.priority]),
    ).toEqual([
      ['Equações', 'HIGH'],
      ['Geometria', 'LOW'],
    ]);
    const [topic, low] = out.topics;
    expect(low).toMatchObject({
      correctCount: 3,
      answeredCount: 4,
      accuracyPct: 75,
      status: 'AVAILABLE',
    });
    expect(low.suggestedQuestions).toHaveLength(3);
    expect(topic).toMatchObject({
      topicId: EQ,
      topicName: 'Equações',
      priority: 'HIGH',
      correctCount: 1,
      answeredCount: 4,
      accuracyPct: 25,
      status: 'AVAILABLE',
    });
    // RN-08: ordered by difficulty, then creation date. The topic has 3 easy extras, so those win.
    expect(topic.suggestedQuestions.map((q: { difficulty: string }) => q.difficulty)).toEqual([
      'easy',
      'easy',
      'easy',
    ]);
    expect(topic.suggestedQuestions.map((q: { id: string }) => q.id)).toEqual([
      '22222222-2222-4222-8222-000000000009',
      '22222222-2222-4222-8222-000000000015',
      '22222222-2222-4222-8222-000000000016',
    ]);
    const ids = topic.suggestedQuestions.map((q: { id: string }) => q.id);
    expect(ids.some((id: string) => QUESTION_IDS.includes(id))).toBe(false);
    expect(Object.keys(topic.suggestedQuestions[0]).sort()).toEqual([
      'difficulty',
      'id',
      'options',
      'statement',
    ]);
    expect(res.body).not.toMatch(/correct_?option|explanation/i);
  });

  it('75% in both topics: NEEDS_REVIEW with only optional (LOW) reviews', async () => {
    // one mistake per topic: Equações 3/4, Geometria 3/4
    await submit(['B', 'B', 'C', 'A', 'B', 'C', 'B', 'A']);
    const out = (await recs()).json();
    expect(out.status).toBe('NEEDS_REVIEW');
    expect(out.topics.map((t: { priority: string }) => t.priority)).toEqual(['LOW', 'LOW']);
    expect(
      out.topics.every((t: { suggestedQuestions: unknown[] }) => t.suggestedQuestions.length === 3),
    ).toBe(true);
  });

  it('returns ON_TRACK only when there are no mistakes to review', async () => {
    await submit(CORRECT);
    const out = (await recs()).json();
    expect(out).toMatchObject({ status: 'ON_TRACK', evaluatedAttempts: 1, topics: [] });
  });

  it('CA-08: a priority topic without unseen questions returns NO_NEW_QUESTIONS', async () => {
    await submit(EQ_1_OF_4);
    // The student already answered the 3 extra Equações questions in an older attempt.
    // (Geometria stays LOW and keeps its own suggestions.)
    const [{ id }] = await ds.query(
      `INSERT INTO attempts (student_id, quiz_id, request_id, payload_hash, correct_count, total_count, score_pct, submitted_at)
       VALUES ($1, $2, gen_random_uuid(), repeat('b', 64), 0, 3, 0, '2026-01-01T00:00:00Z') RETURNING id`,
      [user.studentId, DEMO_QUIZ_ID],
    );
    await ds.query(
      `INSERT INTO attempt_answers (attempt_id, question_id, selected_option, is_correct)
       SELECT $1, q.id, 'A', false FROM questions q
       WHERE q.topic_id = $2 AND NOT EXISTS (SELECT 1 FROM quiz_questions qq WHERE qq.question_id = q.id)`,
      [id, EQ],
    );

    const out = (await recs()).json();
    expect(out.evaluatedAttempts).toBe(2);
    const topic = out.topics.find((t: { topicId: string }) => t.topicId === EQ);
    expect(topic).toMatchObject({
      topicId: EQ,
      priority: 'HIGH',
      status: 'NO_NEW_QUESTIONS',
      suggestedQuestions: [],
      correctCount: 1,
      answeredCount: 12,
    });
    expect(topic.message).toEqual(expect.any(String));
  });

  it('priority follows the CURRENT state: wrong answers that were later fixed stop counting', async () => {
    for (let i = 0; i < 4; i += 1) await submit(ALL_WRONG); // same questions missed 4 times
    expect((await recs()).json().status).toBe('NEEDS_REVIEW');

    await submit(CORRECT); // now every question is answered correctly
    const out = (await recs()).json();
    // A plain aggregate would be 8/40 (20%) and flag both topics as HIGH.
    expect(out.status).toBe('ON_TRACK');
    expect(out.topics).toEqual([]);
    expect(out.evaluatedAttempts).toBe(5);
  });

  it('a question answered correctly and then wrongly counts as wrong now', async () => {
    await submit(CORRECT);
    await submit(ALL_WRONG);
    const out = (await recs()).json();
    expect(out.status).toBe('NEEDS_REVIEW');
    expect(out.topics.map((t: { priority: string }) => t.priority)).toEqual(['HIGH', 'HIGH']);
    expect(out.topics[0]).toMatchObject({ correctCount: 0, answeredCount: 4 }); // distinct questions
  });

  it('exposes the progress trajectory, oldest attempt first, with per-topic accuracy', async () => {
    await submit(ALL_WRONG); // 0%
    await submit(EQ_1_OF_4); // 50%: Equações 1/4, Geometria 3/4
    await submit(CORRECT); // 100%
    const { progress } = (await recs()).json();
    expect(progress.map((p: { scorePct: number }) => p.scorePct)).toEqual([0, 50, 100]);
    const equacoes = progress.map(
      (p: { topics: { topicName: string; accuracyPct: number }[] }) =>
        p.topics.find((t) => t.topicName === 'Equações')?.accuracyPct,
    );
    expect(equacoes).toEqual([0, 25, 100]);
    const dates = progress.map((p: { submittedAt: string }) => Date.parse(p.submittedAt));
    expect([...dates].sort((a, b) => a - b)).toEqual(dates);
  });

  it('evaluates the current state over all attempts; progress shows the last 5 full quizzes', async () => {
    await submit(ALL_WRONG); // oldest
    for (let i = 0; i < 5; i += 1) await submit(CORRECT);
    const out = (await recs()).json();
    expect(out).toMatchObject({ status: 'ON_TRACK', evaluatedAttempts: 6, topics: [] });
    expect(out.progress).toHaveLength(5); // the oldest (all wrong) is outside the trajectory
    expect(out.progress.every((p: { scorePct: number }) => p.scorePct === 100)).toBe(true);
  });

  it('CA-09: returns 403 for another student (even one that exists)', async () => {
    const other = await registerUser(app);
    for (const id of [other.studentId, '99999999-9999-4999-8999-999999999999']) {
      const res = await recs(id);
      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe('FORBIDDEN');
    }
  });

  it('returns 400 for a malformed student id', async () => {
    expect((await recs('not-a-uuid')).statusCode).toBe(400);
  });

  it("two students never see each other's history", async () => {
    const other = await registerUser(app);
    const otherClient = asUser(app, other.token);
    await submit(EQ_1_OF_4); // only the first user answers
    const mine = (await recs()).json();
    const theirs = (
      await otherClient.inject({
        method: 'GET',
        url: `/api/v1/students/${other.studentId}/recommendations`,
      })
    ).json();
    expect(mine.status).toBe('NEEDS_REVIEW');
    expect(theirs).toMatchObject({ status: 'NO_HISTORY', evaluatedAttempts: 0, topics: [] });
  });

  it('reflects newly recorded answers', async () => {
    expect((await recs()).json().status).toBe('NO_HISTORY');
    await submit(EQ_1_OF_4);
    expect((await recs()).json().status).toBe('NEEDS_REVIEW');
  });
});

describe('recommendations by subject (?quiz=)', () => {
  /** Answers every question of a simulado with the first option (wrong for the seed questions). */
  const submitQuiz = async (slug: string, pick = 'A'): Promise<void> => {
    const quiz = (await client.inject({ method: 'GET', url: `/api/v1/quizzes/${slug}` })).json();
    const res = await client.inject({
      method: 'POST',
      url: '/api/v1/attempts',
      payload: {
        requestId: randomUUID(),
        studentId: user.studentId,
        quizId: quiz.id,
        answers: quiz.questions.map((q: { id: string }) => ({
          questionId: q.id,
          selectedOption: pick,
        })),
      },
    });
    expect(res.statusCode).toBe(201);
  };
  const names = (body: { topics: { topicName: string }[] }) =>
    body.topics.map((t) => t.topicName).sort();

  it("without a subject it covers every subject, naming each topic's subject", async () => {
    await submitQuiz('demo-geografia');
    await submit(EQ_1_OF_4);
    const body = (await recs()).json();
    expect(body.subject).toBeNull();
    const subjects = new Set(body.topics.map((t: { subject: string }) => t.subject));
    expect(subjects).toEqual(new Set(['Geografia', 'Matemática']));
  });

  it('with a subject it only shows that subject: topics, attempts and evolution', async () => {
    await submitQuiz('demo-geografia');
    await submit(EQ_1_OF_4);
    const geo = (await recs(user.studentId, '?quiz=demo-geografia')).json();
    expect(geo).toMatchObject({
      subject: 'Geografia',
      progressSubject: 'Geografia',
      evaluatedAttempts: 1,
    });
    expect(names(geo)).toEqual(['Geografia Mundial', 'Geografia do Brasil']);
    expect(geo.progress).toHaveLength(1);
    expect(geo.progress[0].topics.map((t: { topicName: string }) => t.topicName).sort()).toEqual([
      'Geografia Mundial',
      'Geografia do Brasil',
    ]);

    const math = (await recs(user.studentId, '?quiz=demo-matematica')).json();
    expect(math).toMatchObject({ subject: 'Matemática', evaluatedAttempts: 1 });
    expect(names(math)).toEqual(['Equações', 'Geometria']);
  });

  it("a subject the student never tried is NO_HISTORY, not someone else's data", async () => {
    await submit(EQ_1_OF_4);
    const res = (await recs(user.studentId, '?quiz=demo-historia')).json();
    expect(res).toMatchObject({
      status: 'NO_HISTORY',
      evaluatedAttempts: 0,
      topics: [],
      progress: [],
    });
  });

  it('the evolution follows the simulado: two History attempts, one Math attempt', async () => {
    await submit(EQ_1_OF_4);
    await submitQuiz('demo-historia');
    await submitQuiz('demo-historia', 'B');
    const hist = (await recs(user.studentId, '?quiz=demo-historia')).json();
    expect(hist.progress).toHaveLength(2);
    const unscoped = (await recs()).json(); // newest full quiz is History
    expect(unscoped.progressSubject).toBe('História');
    expect(unscoped.progress).toHaveLength(2);
  });

  it('rejects an unknown subject and a malformed one, and never leaks another student', async () => {
    expect((await recs(user.studentId, '?quiz=nao-existe')).statusCode).toBe(404);
    expect((await recs(user.studentId, '?quiz=Bad_Slug!')).statusCode).toBe(400);
    expect(
      (await recs('00000000-0000-4000-8000-000000000000', '?quiz=demo-geografia')).statusCode,
    ).toBe(403);
  });
});
