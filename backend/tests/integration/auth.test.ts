import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { DataSource } from 'typeorm';
import { DEMO_QUIZ_ID } from '../../src/database/seeds/data.js';
import { asUser, bearer, buildTestApp, registerUser, TEST_PASSWORD } from '../helpers/auth.js';
import { createSeededTestDb } from '../helpers/test-db.js';

let ds: DataSource;
let app: FastifyInstance;
let nowMs = Date.parse('2026-06-01T12:00:00Z');
const DAY = 24 * 60 * 60_000;

const post = (url: string, payload: unknown, headers: Record<string, string> = {}) =>
  app.inject({ method: 'POST', url, payload: payload as object, headers });
const login = (email: string, password: string) => post('/api/v1/auth/login', { email, password });
const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex');

beforeAll(async () => {
  ds = await createSeededTestDb();
  // A controllable clock drives session expiry and the brute-force windows.
  app = buildTestApp({ dataSource: ds, auth: { now: () => nowMs, sessionTtlMs: 7 * DAY } });
  await app.ready();
});
afterAll(async () => {
  await app.close();
  await ds.destroy();
});

describe('POST /api/v1/auth/register', () => {
  it('creates the account, normalizes the e-mail and opens a session', async () => {
    const res = await post('/api/v1/auth/register', {
      name: '  Maria Souza ',
      email: 'Maria.Souza@Teste.DEV',
      password: TEST_PASSWORD,
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.student).toMatchObject({ name: 'Maria Souza', email: 'maria.souza@teste.dev' });
    expect(body.token).toMatch(/^[A-Za-z0-9_-]{43}$/); // 32 random bytes, base64url
    expect(new Date(body.expiresAt).getTime()).toBe(nowMs + 7 * DAY);
    // Nothing secret comes back.
    expect(res.body).not.toMatch(/password|scrypt|hash/i);
  });

  it('rejects an e-mail with surrounding spaces (the app trims it before sending)', async () => {
    const res = await post('/api/v1/auth/register', {
      name: 'Ana',
      email: ' ana.espaco@teste.dev ',
      password: TEST_PASSWORD,
    });
    expect(res.statusCode).toBe(400);
  });

  it('stores only a scrypt hash of the password and only the hash of the token', async () => {
    const user = await registerUser(app, { email: 'storage@teste.dev' });
    const [row] = await ds.query(`SELECT password_hash FROM students WHERE id = $1`, [
      user.studentId,
    ]);
    expect(row.password_hash).toMatch(/^scrypt\$/);
    expect(row.password_hash).not.toContain(TEST_PASSWORD);

    const sessions = await ds.query(`SELECT token_hash FROM sessions WHERE student_id = $1`, [
      user.studentId,
    ]);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].token_hash).toBe(sha256(user.token));
    expect(sessions[0].token_hash).not.toBe(user.token);
  });

  it('rejects invalid input with 400 and creates nothing', async () => {
    const before = Number((await ds.query(`SELECT count(*) n FROM students`))[0].n);
    const valid = { name: 'Ana', email: 'ana@teste.dev', password: TEST_PASSWORD };
    for (const [label, payload] of Object.entries({
      'short password': { ...valid, password: 'curta123' },
      'password too long': { ...valid, password: 'x'.repeat(129) },
      'bad e-mail': { ...valid, email: 'nao-e-email' },
      'empty name': { ...valid, name: '' },
      'blank name': { ...valid, name: '    ' },
      'long name': { ...valid, name: 'n'.repeat(81) },
      'missing field': { name: 'Ana', email: 'ana@teste.dev' },
    })) {
      const res = await post('/api/v1/auth/register', payload);
      expect(res.statusCode, label).toBe(400);
    }
    expect(Number((await ds.query(`SELECT count(*) n FROM students`))[0].n)).toBe(before);
  });

  it('returns 409 for a duplicate e-mail, ignoring case', async () => {
    await registerUser(app, { email: 'dup@teste.dev' });
    const res = await post('/api/v1/auth/register', {
      name: 'Outra',
      email: 'DUP@teste.dev',
      password: TEST_PASSWORD,
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('EMAIL_TAKEN');
  });

  it('concurrent sign-ups with the same e-mail create exactly one account', async () => {
    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        post('/api/v1/auth/register', {
          name: 'Corrida',
          email: 'corrida@teste.dev',
          password: TEST_PASSWORD,
        }),
      ),
    );
    expect(results.filter((r) => r.statusCode === 201)).toHaveLength(1);
    expect(results.filter((r) => r.statusCode === 409)).toHaveLength(5);
    expect(
      Number(
        (await ds.query(`SELECT count(*) n FROM students WHERE email = 'corrida@teste.dev'`))[0].n,
      ),
    ).toBe(1);
  });
});

describe('POST /api/v1/auth/login', () => {
  it('logs in with the right credentials and the new token works', async () => {
    const user = await registerUser(app, { email: 'login@teste.dev', name: 'Login Ok' });
    const res = await login('LOGIN@teste.dev', TEST_PASSWORD);
    expect(res.statusCode).toBe(200);
    expect(res.json().student).toMatchObject({ id: user.studentId, name: 'Login Ok' });
    expect(res.json().token).not.toBe(user.token); // a fresh session each time

    const me = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: bearer(res.json().token),
    });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toEqual({ id: user.studentId, name: 'Login Ok', email: 'login@teste.dev' });
  });

  it('answers wrong password and unknown e-mail with the same generic 401 (no enumeration)', async () => {
    await registerUser(app, { email: 'enum@teste.dev' });
    const wrongPassword = await login('enum@teste.dev', 'senha-totalmente-errada');
    const unknownEmail = await login('ninguem@teste.dev', 'senha-totalmente-errada');
    for (const res of [wrongPassword, unknownEmail]) {
      expect(res.statusCode).toBe(401);
      expect(res.json().error.code).toBe('INVALID_CREDENTIALS');
    }
    expect(wrongPassword.json()).toEqual(unknownEmail.json());
  });

  it('the seeded demo student has no credentials and cannot log in', async () => {
    const res = await login('demo@teste.dev', TEST_PASSWORD);
    expect(res.statusCode).toBe(401);
  });

  it('rejects malformed login bodies with 400', async () => {
    expect(
      (await post('/api/v1/auth/login', { email: 'nao-e-email', password: 'x' })).statusCode,
    ).toBe(400);
    expect((await post('/api/v1/auth/login', { email: 'a@b.dev' })).statusCode).toBe(400);
    expect((await post('/api/v1/auth/login', { email: 'a@b.dev', password: '' })).statusCode).toBe(
      400,
    );
  });

  it('slows down password guessing: 5 failures block the account, then it recovers', async () => {
    await registerUser(app, { email: 'brute@teste.dev' });
    for (let i = 0; i < 5; i += 1) {
      expect((await login('brute@teste.dev', `errada-${i}-errada`)).statusCode).toBe(401);
    }
    const blocked = await login('brute@teste.dev', TEST_PASSWORD); // even the RIGHT password
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json().error.code).toBe('TOO_MANY_ATTEMPTS');
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);

    nowMs += 16 * 60_000; // the 15-minute window passes
    const ok = await login('brute@teste.dev', TEST_PASSWORD);
    expect(ok.statusCode).toBe(200);
  });

  it('a successful login clears the failure counter', async () => {
    await registerUser(app, { email: 'reset@teste.dev' });
    for (let i = 0; i < 4; i += 1) await login('reset@teste.dev', `errada-${i}-errada`);
    expect((await login('reset@teste.dev', TEST_PASSWORD)).statusCode).toBe(200);
    for (let i = 0; i < 4; i += 1) {
      expect((await login('reset@teste.dev', `errada-${i}-errada`)).statusCode).toBe(401);
    }
    expect((await login('reset@teste.dev', TEST_PASSWORD)).statusCode).toBe(200); // still not blocked
  });
});

describe('sessions', () => {
  it('logout ends only that session', async () => {
    const user = await registerUser(app, { email: 'logout@teste.dev' });
    const second = (await login('logout@teste.dev', TEST_PASSWORD)).json().token as string;

    const out = await post('/api/v1/auth/logout', {}, bearer(user.token));
    expect(out.statusCode).toBe(204);
    expect(
      (await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: bearer(user.token) }))
        .statusCode,
    ).toBe(401);
    expect(
      (await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: bearer(second) }))
        .statusCode,
    ).toBe(200);
  });

  it('a session expires after its lifetime', async () => {
    const user = await registerUser(app, { email: 'expire@teste.dev' });
    const me = () =>
      app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: bearer(user.token) });
    expect((await me()).statusCode).toBe(200);
    nowMs += 7 * DAY - 1000;
    expect((await me()).statusCode).toBe(200);
    nowMs += 2000;
    expect((await me()).statusCode).toBe(401);
  });

  it('deleting a student removes their sessions', async () => {
    const user = await registerUser(app, { email: 'cascade@teste.dev' });
    await ds.query(`DELETE FROM students WHERE id = $1`, [user.studentId]);
    expect(
      Number(
        (
          await ds.query(`SELECT count(*) n FROM sessions WHERE student_id = $1`, [user.studentId])
        )[0].n,
      ),
    ).toBe(0);
    expect(
      (await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: bearer(user.token) }))
        .statusCode,
    ).toBe(401);
  });
});

describe('protected routes', () => {
  const routes: { method: 'GET' | 'POST'; url: string; payload?: object }[] = [
    { method: 'GET', url: '/api/v1/quizzes/demo-matematica' },
    { method: 'POST', url: '/api/v1/attempts', payload: {} },
    { method: 'GET', url: `/api/v1/students/${randomUUID()}/recommendations` },
    { method: 'POST', url: `/api/v1/students/${randomUUID()}/review-quizzes`, payload: {} },
    { method: 'POST', url: `/api/v1/attempts/${randomUUID()}/explanations`, payload: {} },
    { method: 'GET', url: '/api/v1/auth/me' },
    { method: 'POST', url: '/api/v1/auth/logout', payload: {} },
  ];

  it('every one returns 401 without a valid bearer token', async () => {
    const badHeaders: Record<string, string>[] = [
      {},
      { authorization: 'Bearer ' },
      { authorization: 'Bearer curto' },
      { authorization: `Bearer ${'A'.repeat(43)}` }, // well-formed but unknown
      { authorization: `Basic ${Buffer.from('a:b').toString('base64')}` },
      { authorization: 'bearer-without-space' },
    ];
    for (const route of routes) {
      for (const headers of badHeaders) {
        const res = await app.inject({ ...route, headers });
        expect(res.statusCode, `${route.method} ${route.url} ${JSON.stringify(headers)}`).toBe(401);
        expect(res.json().error.code).toBe('UNAUTHENTICATED');
        expect(res.headers['www-authenticate']).toBe('Bearer');
      }
    }
  });

  it('a token in the query string is ignored', async () => {
    const user = await registerUser(app);
    const res = await app.inject({ method: 'GET', url: `/api/v1/auth/me?token=${user.token}` });
    expect(res.statusCode).toBe(401);
  });

  it('health and the preflight stay public', async () => {
    expect((await app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
    const pre = await app.inject({
      method: 'OPTIONS',
      url: '/api/v1/attempts',
      headers: { origin: 'http://localhost:5555', 'access-control-request-method': 'POST' },
    });
    expect(pre.statusCode).toBe(204);
  });

  it('authentication is checked before the body, so a bad body without a token is 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/attempts',
      payload: { nope: true },
    });
    expect(res.statusCode).toBe(401);
  });

  it('a valid token works end to end for the student it belongs to', async () => {
    const user = await registerUser(app);
    const client = asUser(app, user.token);
    expect(
      (await client.inject({ method: 'GET', url: '/api/v1/quizzes/demo-matematica' })).statusCode,
    ).toBe(200);
    const own = await client.inject({
      method: 'GET',
      url: `/api/v1/students/${user.studentId}/recommendations`,
    });
    expect(own.statusCode).toBe(200);
    expect(own.json().status).toBe('NO_HISTORY');
    const other = await client.inject({
      method: 'GET',
      url: `/api/v1/students/${randomUUID()}/recommendations`,
    });
    expect(other.statusCode).toBe(403);
    void DEMO_QUIZ_ID;
  });
});

describe('sign-up throttling', () => {
  it('limits sign-ups per IP (20 per hour) with a 429 and Retry-After', async () => {
    const fresh = buildTestApp({ dataSource: ds, auth: { now: () => nowMs } });
    await fresh.ready();
    let blocked = 0;
    for (let i = 0; i < 22; i += 1) {
      const res = await fresh.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          name: 'Massa',
          email: `massa-${i}-${randomUUID().slice(0, 6)}@teste.dev`,
          password: TEST_PASSWORD,
        },
      });
      if (res.statusCode === 429) {
        blocked += 1;
        expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
      }
    }
    await fresh.close();
    expect(blocked).toBe(2);
  });
});

describe('database constraints', () => {
  it('credentials are all-or-nothing and the e-mail is unique', async () => {
    await expect(
      ds.query(`INSERT INTO students (name, email) VALUES ('Sem hash', 'semhash@teste.dev')`),
    ).rejects.toThrow(/ck_students_credentials/);
    await expect(
      ds.query(`INSERT INTO students (name, password_hash) VALUES ('Sem email', 'scrypt$x')`),
    ).rejects.toThrow(/ck_students_credentials/);
    await registerUser(app, { email: 'unico@teste.dev' });
    await expect(
      ds.query(
        `INSERT INTO students (name, email, password_hash) VALUES ('Clone', 'unico@teste.dev', 'scrypt$x')`,
      ),
    ).rejects.toThrow(/uq_students_email/);
  });
});
