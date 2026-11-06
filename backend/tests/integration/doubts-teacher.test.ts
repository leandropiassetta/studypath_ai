import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { DataSource } from 'typeorm';
import { DEMO_QUIZ_ID } from '../../src/database/seeds/data.js';
import { MockExplanationProvider } from '../../src/modules/ai/providers/mock.js';
import { hashPassword } from '../../src/modules/auth/password.js';
import {
  asUser,
  buildTestApp,
  registerUser,
  TEST_PASSWORD,
  TEST_PASSWORD_COST,
  type TestUser,
} from '../helpers/auth.js';
import { createSeededTestDb } from '../helpers/test-db.js';

const QUESTION_IDS = Array.from(
  { length: 8 },
  (_, i) => `22222222-2222-4222-8222-${String(i + 1).padStart(12, '0')}`,
);
// Wrong on q2 (2x = 10, correct B) and q8; right elsewhere.
const PICKS = ['B', 'A', 'C', 'C', 'B', 'C', 'B', 'A'];
const WRONG_Q = QUESTION_IDS[1]!;
const OTHER_WRONG_Q = QUESTION_IDS[7]!;

let ds: DataSource;
let app: FastifyInstance;
let student: TestUser;
let teacher: TestUser;

/** Teachers cannot sign up through the API, so the test creates one straight in the database. */
async function createTeacher(name: string): Promise<TestUser> {
  const email = `prof-${randomUUID().slice(0, 8)}@teste.dev`;
  const hash = await hashPassword(TEST_PASSWORD, TEST_PASSWORD_COST);
  const [row] = await ds.query(
    `INSERT INTO students (name, email, password_hash, role) VALUES ($1, $2, $3, 'teacher') RETURNING id`,
    [name, email, hash],
  );
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password: TEST_PASSWORD },
  });
  expect(res.statusCode).toBe(200);
  expect(res.json().student.role).toBe('teacher');
  return { token: res.json().token, studentId: row.id, email, name };
}

const submit = async (as: TestUser = student): Promise<string> => {
  const res = await asUser(app, as.token).inject({
    method: 'POST',
    url: '/api/v1/attempts',
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
const openDoubt = async (
  attemptId: string,
  questionId = WRONG_Q,
  extra: object = {},
  as: TestUser = student,
) =>
  (
    await asUser(app, as.token).inject({
      method: 'POST',
      url: '/api/v1/doubts',
      payload: { attemptId, questionId, ...extra },
    })
  ).json().id as string;
const call = (as: TestUser, method: 'GET' | 'POST' | 'PUT', url: string, payload?: object) =>
  asUser(app, as.token).inject({ method, url, ...(payload ? { payload } : {}) });
const hint = (doubtId: string, as: TestUser = student) =>
  call(as, 'POST', `/api/v1/doubts/${doubtId}/hints`);
const callTeacher = (doubtId: string, as: TestUser = student) =>
  call(as, 'POST', `/api/v1/doubts/${doubtId}/teacher`);
const queue = (status = 'waiting', as: TestUser = teacher) =>
  call(as, 'GET', `/api/v1/teacher/doubts?status=${status}`);
const answer = (doubtId: string, text: string, as: TestUser = teacher) =>
  call(as, 'POST', `/api/v1/teacher/doubts/${doubtId}/answer`, { answer: text });

beforeAll(async () => {
  ds = await createSeededTestDb();
  app = buildTestApp({
    dataSource: ds,
    explanationProvider: new MockExplanationProvider(),
    aiTimeoutMs: 300,
  });
  await app.ready();
  student = await registerUser(app, { name: 'Maria Souza' });
  teacher = await createTeacher('Prof. Helena Lima');
});
afterEach(async () => {
  await ds.query('DELETE FROM attempts');
});
afterAll(async () => {
  await app.close();
  await ds.destroy();
});

describe('teacher accounts', () => {
  it('cannot be created through sign-up, and the role is part of the session', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        name: 'Espertinho',
        email: 'espertinho@teste.dev',
        password: TEST_PASSWORD,
        role: 'teacher',
      },
    });
    // Unknown body fields are dropped, never applied: the account comes out as a plain student.
    expect(res.statusCode).toBe(201);
    expect(res.json().student.role).toBe('student');
    const [created] = await ds.query(
      `SELECT role FROM students WHERE email = 'espertinho@teste.dev'`,
    );
    expect(created.role).toBe('student');
    const me = await call(teacher, 'GET', '/api/v1/auth/me');
    expect(me.json().role).toBe('teacher');
    expect((await call(student, 'GET', '/api/v1/auth/me')).json().role).toBe('student');
  });

  it('the teacher area is closed to students (403) and to anonymous callers (401)', async () => {
    const attemptId = await submit();
    const doubtId = await openDoubt(attemptId);
    await callTeacher(doubtId);
    expect((await queue('waiting', student)).statusCode).toBe(403);
    expect((await answer(doubtId, 'Tentando responder', student)).statusCode).toBe(403);
    expect((await app.inject({ method: 'GET', url: '/api/v1/teacher/doubts' })).statusCode).toBe(
      401,
    );
    // ...and the failed attempt changed nothing
    expect((await call(student, 'GET', `/api/v1/doubts/${doubtId}`)).json().status).toBe(
      'WAITING_TEACHER',
    );
  });
});

describe('calling a teacher', () => {
  it('moves the doubt to the queue, promises 14 minutes, and is idempotent', async () => {
    const doubtId = await openDoubt(await submit());
    const first = await callTeacher(doubtId);
    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({
      status: 'WAITING_TEACHER',
      etaMinutes: 14,
      teacherAnswer: null,
    });
    const requestedAt = first.json().teacherRequestedAt as string;
    expect(Date.parse(requestedAt)).not.toBeNaN();

    const again = await callTeacher(doubtId);
    expect(again.json().teacherRequestedAt).toBe(requestedAt); // asking twice keeps the original time
  });

  it("another student cannot call a teacher for someone else's doubt", async () => {
    const other = await registerUser(app);
    const doubtId = await openDoubt(await submit());
    expect((await callTeacher(doubtId, other)).statusCode).toBe(404);
    expect((await call(student, 'GET', `/api/v1/doubts/${doubtId}`)).json().status).toBe(
      'AI_HINTS',
    );
  });
});

describe('the teacher queue', () => {
  it('shows only waiting doubts, oldest first, with the whole context ready', async () => {
    const attemptId = await submit();
    const older = await openDoubt(attemptId, WRONG_Q, { message: 'não entendi por onde começar' });
    await hint(older);
    await hint(older);
    await callTeacher(older);
    const newer = await openDoubt(attemptId, OTHER_WRONG_Q);
    await callTeacher(newer);
    await openDoubt(await submit(), WRONG_Q); // a doubt that never called a teacher stays out

    const list = (await queue()).json();
    expect(list.map((d: { id: string }) => d.id)).toEqual([older, newer]);
    expect(list[0]).toMatchObject({
      status: 'WAITING_TEACHER',
      studentFirstName: 'Maria', // first name only: no full names for the teacher
      topic: 'Equações',
      statement: 'Qual é o valor de x em 2x = 10?',
      selectedOption: 'A',
      correctOption: 'B',
      message: 'não entendi por onde começar',
      hintsUsed: 2,
      misconception: null,
    });
    expect(list[0].referenceExplanation).toContain('Divida os dois lados por 2');
    expect(list[0].aiHints.map((h: { level: number }) => h.level)).toEqual([1, 2]); // what the AI already said
    expect(list[0].waitingMinutes).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(list)).not.toContain('Souza'); // surname never leaves the server
  });

  it('is empty when nobody is waiting', async () => {
    expect((await queue()).json()).toEqual([]);
  });
});

describe('answering', () => {
  it('records the answer, removes the doubt from the queue and shows it to the student', async () => {
    const doubtId = await openDoubt(await submit());
    await callTeacher(doubtId);
    const res = await answer(doubtId, '  Divida os dois lados por 2 e você chega a x = 5.  ');
    expect(res.statusCode).toBe(204);

    const mine = (await call(student, 'GET', `/api/v1/doubts/${doubtId}`)).json();
    expect(mine).toMatchObject({
      status: 'ANSWERED',
      teacherAnswer: 'Divida os dois lados por 2 e você chega a x = 5.',
    });
    expect(Date.parse(mine.answeredAt)).not.toBeNaN();

    expect((await queue()).json()).toEqual([]);
    const done = (await queue('answered')).json();
    expect(done).toHaveLength(1);
    expect(done[0]).toMatchObject({
      id: doubtId,
      status: 'ANSWERED',
      answer: 'Divida os dois lados por 2 e você chega a x = 5.',
    });
  });

  it('the answered list only has what THIS teacher answered', async () => {
    const other = await createTeacher('Prof. Outro');
    const doubtId = await openDoubt(await submit());
    await callTeacher(doubtId);
    await answer(doubtId, 'Minha resposta');
    expect((await queue('answered', other)).json()).toEqual([]);
    expect((await queue('answered', teacher)).json()).toHaveLength(1);
  });

  it('an answered doubt cannot be answered again (409) and keeps the first answer', async () => {
    const doubtId = await openDoubt(await submit());
    await callTeacher(doubtId);
    expect((await answer(doubtId, 'Primeira')).statusCode).toBe(204);
    const second = await answer(doubtId, 'Segunda');
    expect(second.statusCode).toBe(409);
    expect(second.json().error.code).toBe('NOT_WAITING');
    expect((await call(student, 'GET', `/api/v1/doubts/${doubtId}`)).json().teacherAnswer).toBe(
      'Primeira',
    );
  });

  it('two teachers answering at once: exactly one wins', async () => {
    const second = await createTeacher('Prof. Corrida');
    const doubtId = await openDoubt(await submit());
    await callTeacher(doubtId);
    const [a, b] = await Promise.all([
      answer(doubtId, 'Resposta A', teacher),
      answer(doubtId, 'Resposta B', second),
    ]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([204, 409]);
    const stored = (await call(student, 'GET', `/api/v1/doubts/${doubtId}`)).json().teacherAnswer;
    expect(stored).toBe(a.statusCode === 204 ? 'Resposta A' : 'Resposta B');
  });

  it('cannot answer a doubt that was never sent to teachers, or one that does not exist', async () => {
    const doubtId = await openDoubt(await submit()); // still AI_HINTS
    expect((await answer(doubtId, 'Cedo demais')).statusCode).toBe(409);
    expect((await answer(randomUUID(), 'Fantasma')).statusCode).toBe(409);
  });

  it('validates the answer text', async () => {
    const doubtId = await openDoubt(await submit());
    await callTeacher(doubtId);
    expect((await answer(doubtId, '')).statusCode).toBe(400);
    expect((await answer(doubtId, '   ')).statusCode).toBe(400);
    expect((await answer(doubtId, 'x'.repeat(2001))).statusCode).toBe(400);
    // None of the rejected attempts changed the doubt.
    expect((await call(student, 'GET', `/api/v1/doubts/${doubtId}`)).json().status).toBe(
      'WAITING_TEACHER',
    );
    // An unknown field is ignored; a valid answer still goes through.
    const withExtra = await call(teacher, 'POST', `/api/v1/teacher/doubts/${doubtId}/answer`, {
      answer: 'ok',
      extra: 1,
    });
    expect(withExtra.statusCode).toBe(204);
  });
});

describe('student feedback ("isso ajudou?")', () => {
  const feedback = (doubtId: string, body: object, as: TestUser = student) =>
    call(as, 'PUT', `/api/v1/doubts/${doubtId}/feedback`, body);

  it('rates the AI only after receiving a hint, and the teacher only after an answer', async () => {
    const doubtId = await openDoubt(await submit());
    const early = await feedback(doubtId, { aiHelpful: true });
    expect(early.statusCode).toBe(409);
    expect(early.json().error.code).toBe('NO_HINTS_YET');

    await hint(doubtId);
    expect((await feedback(doubtId, { aiHelpful: true })).json()).toMatchObject({
      aiHelpful: true,
      teacherHelpful: null,
    });

    const tooSoon = await feedback(doubtId, { teacherHelpful: true });
    expect(tooSoon.statusCode).toBe(409);
    expect(tooSoon.json().error.code).toBe('NOT_ANSWERED_YET');

    await callTeacher(doubtId);
    await answer(doubtId, 'Aqui está');
    const done = await feedback(doubtId, { teacherHelpful: false });
    expect(done.json()).toMatchObject({ aiHelpful: true, teacherHelpful: false }); // the earlier rating is kept
  });

  it('can be changed, and rejects empty or unknown bodies and other students', async () => {
    const other = await registerUser(app);
    const doubtId = await openDoubt(await submit());
    await hint(doubtId);
    await feedback(doubtId, { aiHelpful: true });
    expect((await feedback(doubtId, { aiHelpful: false })).json().aiHelpful).toBe(false);
    expect((await feedback(doubtId, {})).statusCode).toBe(400);
    const withExtra = await feedback(doubtId, { aiHelpful: true, nota: 10 }); // unknown field is dropped
    expect(withExtra.statusCode).toBe(200);
    expect(withExtra.json()).not.toHaveProperty('nota');
    expect((await feedback(doubtId, { aiHelpful: true }, other)).statusCode).toBe(404);
  });
});

describe('database guarantees', () => {
  it('a doubt is answered if and only if it has an answer, and cannot wait without a request time', async () => {
    const doubtId = await openDoubt(await submit());
    await expect(
      ds.query(`UPDATE doubts SET status = 'ANSWERED' WHERE id = $1`, [doubtId]),
    ).rejects.toThrow(/ck_doubts_answered/);
    await expect(
      ds.query(`UPDATE doubts SET status = 'WAITING_TEACHER' WHERE id = $1`, [doubtId]),
    ).rejects.toThrow(/ck_doubts_waiting/);
    await expect(
      ds.query(`INSERT INTO students (name, role) VALUES ('X', 'admin')`),
    ).rejects.toThrow(/ck_students_role/);
  });
});
