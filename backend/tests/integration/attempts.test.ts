import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { DataSource } from 'typeorm';
import { DEMO_QUIZ_ID } from '../../src/database/seeds/data.js';
import { AttemptRepository } from '../../src/modules/attempts/repository.js';
import { asUser, buildTestApp, registerUser, type TestUser } from '../helpers/auth.js';
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
  studentId: user.studentId,
  quizId: DEMO_QUIZ_ID,
  answers: QUESTION_IDS.map((questionId, i) => ({ questionId, selectedOption: picks[i] })),
  ...overrides,
});

let ds: DataSource;
let app: FastifyInstance;
let user: TestUser;
let client: ReturnType<typeof asUser>;

const post = (payload: unknown) =>
  client.inject({ method: 'POST', url: '/api/v1/attempts', payload: payload as object });
const count = async (table: string): Promise<number> =>
  Number((await ds.query<{ n: string }[]>(`SELECT count(*) n FROM ${table}`))[0]?.n);

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

describe('POST /api/v1/attempts', () => {
  it('seed answer key matches the test fixture', async () => {
    const rows = await ds.query<{ correct_option: string }[]>(
      `SELECT q.correct_option FROM quiz_questions qq JOIN questions q ON q.id = qq.question_id
       WHERE qq.quiz_id = '${DEMO_QUIZ_ID}' ORDER BY qq.position`,
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
    const bad = await client.inject({
      method: 'POST',
      url: '/api/v1/attempts',
      headers: { 'content-type': 'application/json' },
      payload: '{oops',
    });
    expect(bad.statusCode).toBe(400);
    expect(await count('attempts')).toBe(0);
  });

  it('CA-09: returns 403 when the body names another student than the authenticated one', async () => {
    const other = await registerUser(app);
    const res = await post(body(CORRECT, { studentId: other.studentId }));
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
    expect(await count('attempts')).toBe(0);

    const unknown = await post(
      body(CORRECT, { studentId: '99999999-9999-4999-8999-999999999999' }),
    );
    expect(unknown.statusCode).toBe(403);
  });

  it('returns 404 for an unknown quiz', async () => {
    const quiz = await post(body(CORRECT, { quizId: '99999999-9999-4999-8999-999999999999' }));
    expect(quiz.statusCode).toBe(404);
    expect(quiz.json().error.code).toBe('QUIZ_NOT_FOUND');
  });

  it('each student only ever sees their own attempts (two users, same requestId)', async () => {
    const other = await registerUser(app);
    const otherClient = asUser(app, other.token);
    const mine = await post(body(CORRECT));
    const theirs = await otherClient.inject({
      method: 'POST',
      url: '/api/v1/attempts',
      payload: body(WRONG, { studentId: other.studentId }),
    });
    // The same requestId is independent per student: both are created, neither is a replay/conflict.
    expect(mine.statusCode).toBe(201);
    expect(theirs.statusCode).toBe(201);
    expect(mine.json().attemptId).not.toBe(theirs.json().attemptId);
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

  /** Edits that must never change an attempt that was already graded. */
  async function withEditedContent<T>(run: () => Promise<T>): Promise<T> {
    const first = QUESTION_IDS[0];
    await ds.query(
      `UPDATE questions SET correct_option = 'A', reference_explanation = 'TEXTO NOVO' WHERE id = $1`,
      [first],
    );
    await ds.query(`UPDATE topics SET name = name || ' (renomeado)'`);
    await ds.query(`DELETE FROM quiz_questions WHERE question_id = $1`, [QUESTION_IDS[7]]);
    try {
      return await run();
    } finally {
      await ds.query(
        `UPDATE questions SET correct_option = 'B', reference_explanation = 'Subtraia 2 dos dois lados: x = 5 - 2 = 3.' WHERE id = $1`,
        [first],
      );
      await ds.query(`UPDATE topics SET name = replace(name, ' (renomeado)', '')`);
      await ds.query(
        `INSERT INTO quiz_questions (quiz_id, question_id, position) VALUES ($1, $2, 8)`,
        [DEMO_QUIZ_ID, QUESTION_IDS[7]],
      );
    }
  }

  it('a replay returns the ORIGINAL result, field by field, even after the content is edited', async () => {
    const first = await post(body(CORRECT, { requestId: rid }));
    expect(first.statusCode).toBe(201);
    const replay = await withEditedContent(() => post(body(CORRECT, { requestId: rid })));
    expect(replay.statusCode).toBe(200);
    // Everything the student saw: gabarito, explanation, topic names, totals, scores.
    expect(replay.json()).toEqual(first.json());
    expect(replay.json().answers[0]).toMatchObject({ isCorrect: true, correctOption: 'B' });
    expect(replay.json().answers[0].referenceExplanation).not.toBe('TEXTO NOVO');
    expect(replay.json().totalCount).toBe(8); // a question left the quiz, the result keeps 8
  });

  it('the snapshot is stored with the attempt, and is what the replay serves', async () => {
    const first = await post(body(CORRECT, { requestId: rid }));
    const [row] = await ds.query(`SELECT result FROM attempts WHERE id = $1`, [
      first.json().attemptId,
    ]);
    expect(row.result.correctCount).toBe(8);
    expect(row.result.answers[0].correctOption).toBe('B');
    expect(row.result.attemptId).toBeUndefined(); // ids come from the row, not the snapshot
  });

  it('an attempt made before snapshots is rebuilt once on its first replay, then frozen', async () => {
    const first = await post(body(CORRECT, { requestId: rid }));
    await ds.query(`UPDATE attempts SET result = NULL WHERE id = $1`, [first.json().attemptId]); // legacy row
    const rebuilt = await post(body(CORRECT, { requestId: rid }));
    expect(rebuilt.statusCode).toBe(200);
    expect(rebuilt.json()).toEqual(first.json());
    const [row] = await ds.query(`SELECT result FROM attempts WHERE id = $1`, [
      first.json().attemptId,
    ]);
    expect(row.result).not.toBeNull(); // frozen now
    const later = await withEditedContent(() => post(body(CORRECT, { requestId: rid })));
    expect(later.json()).toEqual(first.json());
  });

  it('a valid attempt can still be replayed after its quiz is deactivated; new ones are refused', async () => {
    const first = await post(body(CORRECT, { requestId: rid }));
    await ds.query(`UPDATE quizzes SET is_active = false WHERE id = $1`, [DEMO_QUIZ_ID]);
    try {
      const replay = await post(body(CORRECT, { requestId: rid }));
      expect(replay.statusCode).toBe(200);
      expect(replay.json()).toEqual(first.json());
      const fresh = await post(body(CORRECT, { requestId: randomUUID() }));
      expect(fresh.statusCode).toBe(404);
    } finally {
      await ds.query(`UPDATE quizzes SET is_active = true WHERE id = $1`, [DEMO_QUIZ_ID]);
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
    // The requestId is already taken by a different payload: that is a conflict, not a new quiz.
    expect(other.statusCode).toBe(409);
    expect(other.json().error.code).toBe('REQUEST_ID_CONFLICT');
    // A fresh requestId for an unknown quiz is simply not found.
    const unknown = await post(
      body(CORRECT, { requestId: randomUUID(), quizId: '99999999-9999-4999-8999-999999999999' }),
    );
    expect(unknown.statusCode).toBe(404);
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
        studentId: user.studentId,
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
