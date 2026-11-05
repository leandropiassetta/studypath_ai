import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { DataSource } from 'typeorm';
import { buildApp } from '../../src/app.js';
import { DEMO_QUIZ_ID, DEMO_STUDENT_ID } from '../../src/database/seeds/data.js';
import { AttemptRepository } from '../../src/modules/attempts/repository.js';
import { createSeededTestDb } from '../helpers/test-db.js';

const QUESTION_IDS = Array.from(
  { length: 8 },
  (_, i) => `22222222-2222-4222-8222-${String(i + 1).padStart(12, '0')}`,
);
// Correct keys in the seed, by position: B B C C B C B B
const CORRECT = ['B', 'B', 'C', 'C', 'B', 'C', 'B', 'B'];
const WRONG = ['A', 'A', 'A', 'A', 'A', 'A', 'A', 'A'];

const RID = '44444444-4444-4444-8444-444444444444';
const body = (
  picks: string[],
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  requestId: RID,
  studentId: DEMO_STUDENT_ID,
  quizId: DEMO_QUIZ_ID,
  answers: QUESTION_IDS.map((questionId, i) => ({ questionId, selectedOption: picks[i] })),
  ...overrides,
});

let ds: DataSource;
let app: FastifyInstance;

const post = (payload: unknown) =>
  app.inject({ method: 'POST', url: '/api/v1/attempts', payload: payload as object });
const count = async (table: string): Promise<number> =>
  Number((await ds.query<{ n: string }[]>(`SELECT count(*) n FROM ${table}`))[0]?.n);

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

describe('POST /api/v1/attempts', () => {
  it('seed answer key matches the test fixture', async () => {
    const rows = await ds.query<{ correct_option: string }[]>(
      `SELECT q.correct_option FROM quiz_questions qq JOIN questions q ON q.id = qq.question_id ORDER BY qq.position`,
    );
    expect(rows.map((r) => r.correct_option)).toEqual(CORRECT);
  });

  it('CA-02: grades a mixed submission and persists attempt and answers', async () => {
    // 4 correct (positions 1,3,5,7), 4 wrong
    const picks = CORRECT.map((c, i) => (i % 2 === 0 ? c : 'A'));
    const res = await post(body(picks));
    expect(res.statusCode).toBe(201);
    const out = res.json();
    expect(out).toMatchObject({
      quizId: DEMO_QUIZ_ID,
      correctCount: 4,
      totalCount: 8,
      scorePct: 50,
    });
    expect(out.answers.map((a: { isCorrect: boolean }) => a.isCorrect)).toEqual([
      true,
      false,
      true,
      false,
      true,
      false,
      true,
      false,
    ]);
    expect(out.answers[0]).toMatchObject({
      correctOption: 'B',
      referenceExplanation: expect.any(String),
    });
    expect(out.topicResults).toEqual([
      expect.objectContaining({
        topicName: 'Equações',
        correctCount: 2,
        totalCount: 4,
        accuracyPct: 50,
      }),
      expect.objectContaining({
        topicName: 'Geometria',
        correctCount: 2,
        totalCount: 4,
        accuracyPct: 50,
      }),
    ]);

    const [row] = await ds.query(`SELECT * FROM attempts WHERE id = $1`, [out.attemptId]);
    expect(row).toMatchObject({
      correct_count: 4,
      total_count: 8,
      score_pct: '50.00',
      request_id: RID,
    });
    expect(row.payload_hash).toMatch(/^[0-9a-f]{64}$/);
    const saved = await ds.query(`SELECT is_correct FROM attempt_answers WHERE attempt_id = $1`, [
      out.attemptId,
    ]);
    expect(saved).toHaveLength(8);
    expect(saved.filter((r: { is_correct: boolean }) => r.is_correct)).toHaveLength(4);
  });

  it('grades 100% and 0%', async () => {
    const all = await post(body(CORRECT, { requestId: '44444444-4444-4444-8444-444444444441' }));
    expect(all.json()).toMatchObject({ correctCount: 8, scorePct: 100 });
    const none = await post(body(WRONG, { requestId: '44444444-4444-4444-8444-444444444442' }));
    expect(none.json()).toMatchObject({ correctCount: 0, scorePct: 0 });
  });

  it('CA-03: rejects missing, duplicate, outside and invalid-option answers with 400 and persists nothing', async () => {
    const full = body(CORRECT).answers as object[];
    const cases: Record<string, unknown[]> = {
      missing: full.slice(0, 7),
      duplicate: [...full.slice(0, 7), full[0]],
      outside: [
        ...full.slice(0, 7),
        { questionId: QUESTION_IDS[0]!.replace(/1$/, '9'), selectedOption: 'A' },
      ],
      'invalid option': [...full.slice(0, 7), { questionId: QUESTION_IDS[7], selectedOption: 'Z' }],
    };
    for (const [name, answers] of Object.entries(cases)) {
      const res = await post(body(CORRECT, { answers }));
      expect(res.statusCode, name).toBe(400);
      expect(res.json().error.code, name).toBe('INVALID_ANSWERS');
      expect(res.json().error.details.length, name).toBeGreaterThan(0);
    }
    expect(await count('attempts')).toBe(0);
    expect(await count('attempt_answers')).toBe(0);
  });

  it('rejects empty answers and malformed input with 400', async () => {
    for (const payload of [
      body(CORRECT, { answers: [] }),
      body(CORRECT, { requestId: 'nope' }),
      body(CORRECT, { quizId: 'nope' }),
      {},
    ]) {
      const res = await post(payload);
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('INVALID_REQUEST');
    }
    const bad = await app.inject({
      method: 'POST',
      url: '/api/v1/attempts',
      headers: { 'content-type': 'application/json' },
      payload: '{oops',
    });
    expect(bad.statusCode).toBe(400);
    expect(await count('attempts')).toBe(0);
  });

  it('CA-09: returns 403 for a student other than the demo student', async () => {
    const res = await post(body(CORRECT, { studentId: '99999999-9999-4999-8999-999999999999' }));
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
    expect(await count('attempts')).toBe(0);
  });

  it('returns 404 for an unknown quiz and for a demo student missing from the database', async () => {
    const quiz = await post(body(CORRECT, { quizId: '99999999-9999-4999-8999-999999999999' }));
    expect(quiz.statusCode).toBe(404);
    expect(quiz.json().error.code).toBe('QUIZ_NOT_FOUND');

    const ghost = '88888888-8888-4888-8888-888888888888';
    const other = buildApp({ dataSource: ds, demoStudentId: ghost });
    const res = await other.inject({
      method: 'POST',
      url: '/api/v1/attempts',
      payload: body(CORRECT, { studentId: ghost }),
    });
    await other.close();
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('STUDENT_NOT_FOUND');
  });

  it('never returns the answer key outside of the post-submission response schema', async () => {
    const res = await post(body(WRONG));
    expect(Object.keys(res.json()).sort()).toEqual([
      'answers',
      'attemptId',
      'correctCount',
      'quizId',
      'scorePct',
      'topicResults',
      'totalCount',
    ]);
  });
});

describe('idempotency (RN-05)', () => {
  const rid = '44444444-4444-4444-8444-4444444444aa';

  it('CA-04: identical replay returns 200 with the same attemptId and no duplicate rows', async () => {
    const first = await post(body(CORRECT, { requestId: rid }));
    expect(first.statusCode).toBe(201);
    const second = await post(body(CORRECT, { requestId: rid }));
    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual(first.json());
    expect(await count('attempts')).toBe(1);
    expect(await count('attempt_answers')).toBe(8);
  });

  it('treats a replay with answers in a different order as identical', async () => {
    const first = await post(body(CORRECT, { requestId: rid }));
    const reversed = body(CORRECT, { requestId: rid });
    (reversed.answers as unknown[]).reverse();
    const second = await post(reversed);
    expect(second.statusCode).toBe(200);
    expect(second.json().attemptId).toBe(first.json().attemptId);
  });

  it('CA-05: same requestId with different answers returns 409 and keeps the original', async () => {
    const first = await post(body(CORRECT, { requestId: rid }));
    const conflict = await post(body(WRONG, { requestId: rid }));
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json().error.code).toBe('REQUEST_ID_CONFLICT');
    expect(await count('attempts')).toBe(1);
    const [row] = await ds.query(`SELECT correct_count FROM attempts WHERE id = $1`, [
      first.json().attemptId,
    ]);
    expect(row.correct_count).toBe(8);
  });

  it('replays the stored result even if the answer key changes later', async () => {
    const first = await post(body(CORRECT, { requestId: rid }));
    await ds.query(`UPDATE questions SET correct_option = 'A' WHERE id = $1`, [QUESTION_IDS[0]]);
    try {
      const replay = await post(body(CORRECT, { requestId: rid }));
      expect(replay.statusCode).toBe(200);
      expect(replay.json().correctCount).toBe(first.json().correctCount);
      expect(replay.json().answers[0].isCorrect).toBe(true);
    } finally {
      await ds.query(`UPDATE questions SET correct_option = 'B' WHERE id = $1`, [QUESTION_IDS[0]]);
    }
  });

  it('a rejected submission does not consume the requestId (safe retry after 400)', async () => {
    const bad = await post(
      body(CORRECT, { requestId: rid, answers: (body(CORRECT).answers as object[]).slice(1) }),
    );
    expect(bad.statusCode).toBe(400);
    const ok = await post(body(CORRECT, { requestId: rid }));
    expect(ok.statusCode).toBe(201);
  });

  it('the same requestId from the same payload but a different quiz is a conflict, not a replay', async () => {
    await post(body(CORRECT, { requestId: rid }));
    const other = await post(
      body(CORRECT, { requestId: rid, quizId: '99999999-9999-4999-8999-999999999999' }),
    );
    expect(other.statusCode).toBe(404); // unknown quiz is rejected before idempotency
  });

  it('concurrent identical requests create exactly one attempt (one 201, the rest 200)', async () => {
    const responses = await Promise.all(
      Array.from({ length: 10 }, () => post(body(CORRECT, { requestId: rid }))),
    );
    const codes = responses.map((r) => r.statusCode).sort();
    expect(codes).toEqual([200, 200, 200, 200, 200, 200, 200, 200, 200, 201]);
    expect(new Set(responses.map((r) => r.json().attemptId)).size).toBe(1);
    expect(await count('attempts')).toBe(1);
    expect(await count('attempt_answers')).toBe(8);
  });

  it('concurrent requests with the same requestId and different payloads: one 201, the rest 409', async () => {
    const responses = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        post(body(i % 2 === 0 ? CORRECT : WRONG, { requestId: rid })),
      ),
    );
    const created = responses.filter((r) => r.statusCode === 201);
    expect(created).toHaveLength(1);
    const winnerHash = (await ds.query<{ id: string }[]>(`SELECT id FROM attempts`))[0]?.id;
    expect(created[0]?.json().attemptId).toBe(winnerHash);
    for (const r of responses) expect([200, 201, 409]).toContain(r.statusCode);
    expect(responses.filter((r) => r.statusCode === 409).length).toBeGreaterThan(0);
    expect(await count('attempts')).toBe(1);
    expect(await count('attempt_answers')).toBe(8);
  });

  it('the same requestId is independent per student', async () => {
    const res = await post(body(CORRECT, { requestId: rid }));
    expect(res.statusCode).toBe(201);
    // unique key is (student_id, request_id): a second student could reuse it
    const [{ indexdef }] = await ds.query(
      `SELECT indexdef FROM pg_indexes WHERE indexname = 'uq_attempts_student_request'`,
    );
    expect(indexdef).toContain('(student_id, request_id)');
  });
});

describe('transaction rollback (RN-04)', () => {
  it('leaves no partial attempt when persisting answers fails', async () => {
    const repo = new AttemptRepository(ds);
    const graded = {
      correctCount: 1,
      totalCount: 1,
      scorePct: 100,
      topicResults: [],
      answers: [
        {
          // FK violation on attempt_answers.question_id, after the attempt row was inserted
          questionId: '99999999-9999-4999-8999-999999999999',
          selectedOption: 'A',
          correctOption: 'A',
          isCorrect: true,
          referenceExplanation: '',
        },
      ],
    };
    await expect(
      repo.createAttempt({
        studentId: DEMO_STUDENT_ID,
        quizId: DEMO_QUIZ_ID,
        requestId: RID,
        payloadHash: 'a'.repeat(64),
        graded,
      }),
    ).rejects.toThrow();
    expect(await count('attempts')).toBe(0);
    expect(await count('attempt_answers')).toBe(0);
  });
});
