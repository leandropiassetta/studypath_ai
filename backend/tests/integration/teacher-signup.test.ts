import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { DataSource } from 'typeorm';
import { asUser, buildTestApp, TEST_PASSWORD } from '../helpers/auth.js';
import { createSeededTestDb } from '../helpers/test-db.js';

const CODE = 'convite-de-teste-123';
let ds: DataSource;
let app: FastifyInstance;
let nowMs = Date.parse('2026-06-01T12:00:00Z');
let n = 0;

const signUp = (payload: Record<string, unknown>, ip = '10.0.0.1') =>
  app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    remoteAddress: ip,
    payload: {
      name: 'Pessoa Teste',
      email: `pessoa-${++n}@teste.dev`,
      password: TEST_PASSWORD,
      ...payload,
    },
  });
const roleInDb = async (email: string): Promise<string | undefined> =>
  (await ds.query('SELECT role FROM students WHERE email = $1', [email]))[0]?.role;

beforeAll(async () => {
  ds = await createSeededTestDb();
  app = buildTestApp({
    dataSource: ds,
    auth: { teacherInviteCode: CODE, now: () => nowMs },
  });
  await app.ready();
});
afterAll(async () => {
  await app.close();
  await ds.destroy();
});

describe('sign-up with a role', () => {
  it('a student needs no code, and role "student" is the default', async () => {
    const plain = await signUp({});
    expect(plain.statusCode).toBe(201);
    expect(plain.json().student.role).toBe('student');
    const explicit = await signUp({ role: 'student' });
    expect(explicit.json().student.role).toBe('student');
  });

  it('a student who sends an invite code is still just a student', async () => {
    const res = await signUp({ role: 'student', inviteCode: CODE });
    expect(res.statusCode).toBe(201);
    expect(res.json().student.role).toBe('student');
  });

  it('a teacher with the right code gets a teacher account that can open the queue', async () => {
    const res = await signUp({ role: 'teacher', inviteCode: CODE, name: 'Profa. Nova' });
    expect(res.statusCode).toBe(201);
    expect(res.json().student).toMatchObject({ name: 'Profa. Nova', role: 'teacher' });
    expect(await roleInDb(res.json().student.email)).toBe('teacher');

    const queue = await asUser(app, res.json().token).inject({
      method: 'GET',
      url: '/api/v1/teacher/doubts',
    });
    expect(queue.statusCode).toBe(200);
    // The role is also what login returns afterwards.
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: res.json().student.email, password: TEST_PASSWORD },
    });
    expect(login.json().student.role).toBe('teacher');
  });

  it('a wrong, missing or empty code is refused with the same error and creates nothing', async () => {
    for (const inviteCode of ['codigo-errado', '', undefined, CODE.toUpperCase(), `${CODE} `]) {
      const email = `nope-${++n}@teste.dev`;
      const res = await signUp(
        { role: 'teacher', email, ...(inviteCode === undefined ? {} : { inviteCode }) },
        `10.0.1.${n}`,
      );
      expect(res.statusCode, String(inviteCode)).toBe(403);
      expect(res.json().error.code).toBe('INVALID_INVITE_CODE');
      expect(await roleInDb(email)).toBeUndefined();
    }
  });

  it('never echoes the code back, in the error or anywhere in the response', async () => {
    const res = await signUp({ role: 'teacher', inviteCode: 'um-chute-qualquer' }, '10.0.2.1');
    expect(res.body).not.toContain('um-chute-qualquer');
    expect(res.body).not.toContain(CODE);
  });

  it('guessing is rate limited per IP, and the limit does not hit other IPs', async () => {
    const ip = '10.0.3.1';
    for (let i = 0; i < 5; i++) {
      expect((await signUp({ role: 'teacher', inviteCode: `chute-${i}` }, ip)).statusCode).toBe(
        403,
      );
    }
    const blocked = await signUp({ role: 'teacher', inviteCode: CODE }, ip); // even the right one
    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers['retry-after']).toBeDefined();
    // Another IP is unaffected.
    expect((await signUp({ role: 'teacher', inviteCode: CODE }, '10.0.3.2')).statusCode).toBe(201);
    // And the block ends with the window.
    nowMs += 16 * 60_000;
    expect((await signUp({ role: 'teacher', inviteCode: CODE }, ip)).statusCode).toBe(201);
  });

  it('rejects an unknown role and a malformed code', async () => {
    expect((await signUp({ role: 'admin', inviteCode: CODE })).statusCode).toBe(400);
    expect((await signUp({ role: 'teacher', inviteCode: 'x'.repeat(129) })).statusCode).toBe(400);
    // A number is coerced to text by the framework: it is a wrong code, never a way in.
    expect((await signUp({ role: 'teacher', inviteCode: 123 })).statusCode).toBe(403);
  });
});

describe('without TEACHER_INVITE_CODE', () => {
  it('teacher sign-up is switched off, even for someone who guesses a code', async () => {
    const off = buildTestApp({ dataSource: ds });
    await off.ready();
    const res = await off.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        name: 'X',
        email: 'off@teste.dev',
        password: TEST_PASSWORD,
        role: 'teacher',
        inviteCode: CODE,
      },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('TEACHER_SIGNUP_DISABLED');
    expect(await roleInDb('off@teste.dev')).toBeUndefined();
    await off.close();
  });
});
