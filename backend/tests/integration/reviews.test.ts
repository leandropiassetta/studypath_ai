import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { DataSource } from 'typeorm';
import { buildApp } from '../../src/app.js';
import { DEMO_QUIZ_ID, DEMO_STUDENT_ID } from '../../src/database/seeds/data.js';
import { createSeededTestDb } from '../helpers/test-db.js';

const QUIZ_QUESTION_IDS = Array.from(
  { length: 8 },
  (_, i) => `22222222-2222-4222-8222-${String(i + 1).padStart(12, '0')}`,
);
const EQ = '33333333-3333-4333-8333-333333333333';
const GEO = '33333333-3333-4333-8333-333333333334';
const CORRECT = ['B', 'B', 'C', 'C', 'B', 'C', 'B', 'B'];
const EQ_1_OF_4 = ['B', 'A', 'A', 'A', 'B', 'C', 'B', 'A']; // Equações 1/4, Geometria 3/4

let ds: DataSource;
let app: FastifyInstance;

interface ReviewQuiz {
  id: string;
  slug: string;
  title: string;
  kind: string;
  newCount: number;
  retryCount: number;
  questions: { id: string; topic: { id: string }; options: { key: string }[] }[];
}

const submitFull = async (picks: string[]): Promise<void> => {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/attempts',
    payload: {
      requestId: randomUUID(),
      studentId: DEMO_STUDENT_ID,
      quizId: DEMO_QUIZ_ID,
      answers: QUIZ_QUESTION_IDS.map((questionId, i) => ({ questionId, selectedOption: picks[i] })),
    },
  });
  expect(res.statusCode).toBe(201);
};
const review = (topicId: string, studentId = DEMO_STUDENT_ID) =>
  app.inject({
    method: 'POST',
    url: `/api/v1/students/${studentId}/review-quizzes`,
    payload: { topicId },
  });
const recs = async () =>
  (
    await app.inject({ method: 'GET', url: `/api/v1/students/${DEMO_STUDENT_ID}/recommendations` })
  ).json();
const count = async (sql: string): Promise<number> =>
  Number((await ds.query<{ n: string }[]>(sql))[0]?.n);

/** Marks the given extra questions as already answered (wrong) in an old attempt. */
const answerExtras = async (topicId: string, limit: number): Promise<void> => {
  const [{ id }] = await ds.query(
    `INSERT INTO attempts (student_id, quiz_id, request_id, payload_hash, correct_count, total_count, score_pct, submitted_at)
     VALUES ($1, $2, gen_random_uuid(), repeat('d', 64), 0, 1, 0, '2026-01-01T00:00:00Z') RETURNING id`,
    [DEMO_STUDENT_ID, DEMO_QUIZ_ID],
  );
  await ds.query(
    `INSERT INTO attempt_answers (attempt_id, question_id, selected_option, is_correct)
     SELECT $1, q.id, 'A', false FROM questions q
     WHERE q.topic_id = $2 AND NOT EXISTS (SELECT 1 FROM quiz_questions qq WHERE qq.question_id = q.id)
     ORDER BY q.created_at LIMIT $3`,
    [id, topicId, limit],
  );
};

beforeAll(async () => {
  ds = await createSeededTestDb();
  app = buildApp({ dataSource: ds, demoStudentId: DEMO_STUDENT_ID });
  await app.ready();
});
afterEach(async () => {
  await ds.query('DELETE FROM attempts');
  await ds.query(`DELETE FROM quizzes WHERE kind = 'review'`);
});
afterAll(async () => {
  await app.close();
  await ds.destroy();
});

describe('POST /api/v1/students/:studentId/review-quizzes', () => {
  it('creates a review quiz with up to 3 unseen questions of the topic, without the answer key', async () => {
    await submitFull(EQ_1_OF_4);
    const res = await review(EQ);
    expect(res.statusCode).toBe(200);
    const quiz = res.json() as ReviewQuiz;
    expect(quiz).toMatchObject({
      kind: 'review',
      title: 'Revisão: Equações',
      newCount: 3,
      retryCount: 0,
    });
    expect(quiz.slug).toMatch(/^revisao-[0-9a-f]{16}$/);
    expect(quiz.questions).toHaveLength(3);
    expect(quiz.questions.every((x) => x.topic.id === EQ)).toBe(true);
    expect(quiz.questions.some((x) => QUIZ_QUESTION_IDS.includes(x.id))).toBe(false);
    expect(res.body).not.toMatch(/correct|explanation/i);
  });

  it('is idempotent: the same review request reuses one quiz', async () => {
    await submitFull(EQ_1_OF_4);
    const [a, b] = await Promise.all([review(EQ), review(EQ)]);
    const c = await review(EQ);
    expect(new Set([a, b, c].map((r) => (r.json() as ReviewQuiz).id)).size).toBe(1);
    expect(await count(`SELECT count(*) n FROM quizzes WHERE kind = 'review'`)).toBe(1);
    expect(
      await count(
        `SELECT count(*) n FROM quiz_questions qq JOIN quizzes z ON z.id = qq.quiz_id WHERE z.kind = 'review'`,
      ),
    ).toBe(3);
  });

  it('the review quiz can be fetched by slug and answered through POST /attempts', async () => {
    await submitFull(EQ_1_OF_4);
    const quiz = (await review(EQ)).json() as ReviewQuiz;

    const get = await app.inject({ method: 'GET', url: `/api/v1/quizzes/${quiz.slug}` });
    expect(get.statusCode).toBe(200);
    expect(get.json().kind).toBe('review');

    const post = await app.inject({
      method: 'POST',
      url: '/api/v1/attempts',
      payload: {
        requestId: randomUUID(),
        studentId: DEMO_STUDENT_ID,
        quizId: quiz.id,
        answers: quiz.questions.map((x) => ({ questionId: x.id, selectedOption: 'A' })),
      },
    });
    expect(post.statusCode).toBe(201);
    expect(post.json().totalCount).toBe(3);
    expect(post.json().topicResults).toHaveLength(1);
  });

  it('review attempts count for the current state but not for the full-quiz trajectory', async () => {
    await submitFull(EQ_1_OF_4);
    const quiz = (await review(EQ)).json() as ReviewQuiz;
    // Look up the key straight from the database (the API never exposes it) and answer correctly.
    const keys = await ds.query<{ id: string; correct_option: string }[]>(
      'SELECT id, correct_option FROM questions WHERE id = ANY($1::uuid[])',
      [quiz.questions.map((x) => x.id)],
    );
    const answers = keys.map((k) => ({ questionId: k.id, selectedOption: k.correct_option }));
    const post = await app.inject({
      method: 'POST',
      url: '/api/v1/attempts',
      payload: { requestId: randomUUID(), studentId: DEMO_STUDENT_ID, quizId: quiz.id, answers },
    });
    expect(post.json()).toMatchObject({ correctCount: 3, scorePct: 100 });

    const out = await recs();
    expect(out.evaluatedAttempts).toBe(2);
    expect(out.progress).toHaveLength(1); // only the full quiz
    const eq = out.topics.find((t: { topicId: string }) => t.topicId === EQ);
    // 4 quiz questions (1 right) + 3 new ones (all right) = 4/7: still HIGH, but improving
    expect(eq).toMatchObject({ priority: 'HIGH', correctCount: 4, answeredCount: 7 });

    // The next review gives the next unseen questions, a different quiz.
    const next = (await review(EQ)).json() as ReviewQuiz;
    expect(next.id).not.toBe(quiz.id);
    expect(next.newCount).toBe(3);
  });

  it('tops up with still-wrong questions when few unseen remain (mixed)', async () => {
    await submitFull(EQ_1_OF_4);
    await answerExtras(EQ, 6); // 8 extras - 6 = 2 unseen
    const quiz = (await review(EQ)).json() as ReviewQuiz;
    expect(quiz).toMatchObject({ newCount: 2, retryCount: 1 });
    expect(quiz.questions).toHaveLength(3);
  });

  it('retries wrong questions when nothing new is left', async () => {
    await submitFull(EQ_1_OF_4);
    await answerExtras(EQ, 8); // every extra already answered (wrong)
    const quiz = (await review(EQ)).json() as ReviewQuiz;
    expect(quiz).toMatchObject({ newCount: 0, retryCount: 3 });
    const wrong = await ds.query<{ question_id: string }[]>(
      `SELECT DISTINCT question_id FROM attempt_answers WHERE NOT is_correct`,
    );
    const wrongIds = new Set(wrong.map((r) => r.question_id));
    expect(quiz.questions.every((x) => wrongIds.has(x.id))).toBe(true);
  });

  it('rejects topics that do not need review, unknown topics, other students and bad input', async () => {
    // No history at all.
    const none = await review(EQ);
    expect(none.statusCode).toBe(400);
    expect(none.json().error.code).toBe('TOPIC_NOT_IN_REVIEW');

    // Everything correct: nothing to review.
    await submitFull(CORRECT);
    expect((await review(EQ)).json().error.code).toBe('TOPIC_NOT_IN_REVIEW');

    expect((await review(randomUUID())).json().error.code).toBe('TOPIC_NOT_FOUND');
    expect((await review(EQ, '99999999-9999-4999-8999-999999999999')).statusCode).toBe(403);
    const bad = await app.inject({
      method: 'POST',
      url: `/api/v1/students/${DEMO_STUDENT_ID}/review-quizzes`,
      payload: { topicId: 'nope' },
    });
    expect(bad.statusCode).toBe(400);
  });

  it('a LOW topic can also be practiced', async () => {
    await submitFull(EQ_1_OF_4); // Geometria 3/4 -> LOW
    const quiz = (await review(GEO)).json() as ReviewQuiz;
    expect(quiz.title).toBe('Revisão: Geometria');
    expect(quiz.newCount).toBe(3);
  });
});
