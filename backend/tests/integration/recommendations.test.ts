import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { DataSource } from 'typeorm';
import { buildApp } from '../../src/app.js';
import { DEMO_QUIZ_ID, DEMO_STUDENT_ID } from '../../src/database/seeds/data.js';
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

const submit = async (picks: string[]): Promise<void> => {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/attempts',
    payload: {
      requestId: randomUUID(),
      studentId: DEMO_STUDENT_ID,
      quizId: DEMO_QUIZ_ID,
      answers: QUESTION_IDS.map((questionId, i) => ({ questionId, selectedOption: picks[i] })),
    },
  });
  expect(res.statusCode).toBe(201);
};
const recs = (studentId = DEMO_STUDENT_ID) =>
  app.inject({ method: 'GET', url: `/api/v1/students/${studentId}/recommendations` });

beforeAll(async () => {
  ds = await createSeededTestDb();
  app = buildApp({ dataSource: ds, demoStudentId: DEMO_STUDENT_ID });
  await app.ready();
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
      studentId: DEMO_STUDENT_ID,
      status: 'NO_HISTORY',
      evaluatedAttempts: 0,
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
    // 3 extras for the topic, easy -> medium -> hard; none from the quiz already answered
    expect(topic.suggestedQuestions.map((q: { difficulty: string }) => q.difficulty)).toEqual([
      'easy',
      'medium',
      'hard',
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
      [DEMO_STUDENT_ID, DEMO_QUIZ_ID],
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
      answeredCount: 7,
    });
    expect(topic.message).toEqual(expect.any(String));
  });

  it('only evaluates the 5 most recent attempts (RN-06)', async () => {
    await submit(ALL_WRONG); // oldest: must fall outside the window
    for (let i = 0; i < 5; i += 1) await submit(CORRECT);
    const out = (await recs()).json();
    expect(out).toMatchObject({ status: 'ON_TRACK', evaluatedAttempts: 5, topics: [] });
  });

  it('CA-09: returns 403 for another student', async () => {
    const res = await recs('99999999-9999-4999-8999-999999999999');
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
  });

  it('returns 400 for a malformed id and 404 when the demo student is missing', async () => {
    expect((await recs('not-a-uuid')).statusCode).toBe(400);

    const ghost = '88888888-8888-4888-8888-888888888888';
    const other = buildApp({ dataSource: ds, demoStudentId: ghost });
    const res = await other.inject({
      method: 'GET',
      url: `/api/v1/students/${ghost}/recommendations`,
    });
    await other.close();
    expect(res.statusCode).toBe(404);
  });

  it('reflects newly recorded answers', async () => {
    expect((await recs()).json().status).toBe('NO_HISTORY');
    await submit(EQ_1_OF_4);
    expect((await recs()).json().status).toBe('NEEDS_REVIEW');
  });
});
