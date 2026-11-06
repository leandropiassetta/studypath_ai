import { randomUUID } from 'node:crypto';
import type { FastifyInstance, InjectOptions } from 'fastify';
import { buildApp, type AppOptions } from '../../src/app.js';

export const TEST_PASSWORD = 'correct-horse-battery';
/** Cheap scrypt so the suite stays fast; production uses the real default cost. */
export const TEST_PASSWORD_COST = 1024;

export function buildTestApp(options: AppOptions) {
  return buildApp({ ...options, auth: { passwordCost: TEST_PASSWORD_COST, ...options.auth } });
}

export interface TestUser {
  token: string;
  studentId: string;
  email: string;
  name: string;
}

export const bearer = (token: string): Record<string, string> => ({
  authorization: `Bearer ${token}`,
});

/** Signs up a fresh student through the real endpoint and returns their session. */
export async function registerUser(
  app: FastifyInstance,
  overrides: { email?: string; name?: string; password?: string } = {},
): Promise<TestUser> {
  const email = overrides.email ?? `aluno-${randomUUID().slice(0, 8)}@teste.dev`;
  const name = overrides.name ?? 'Aluno Teste';
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { name, email, password: overrides.password ?? TEST_PASSWORD },
  });
  if (res.statusCode !== 201) throw new Error(`register failed: ${res.statusCode} ${res.body}`);
  const body = res.json();
  return { token: body.token, studentId: body.student.id, email, name };
}

/** `app.inject` that always sends the user's bearer token. */
export function asUser(app: FastifyInstance, token: string) {
  return {
    inject: (options: InjectOptions) =>
      app.inject({ ...options, headers: { ...options.headers, ...bearer(token) } }),
  };
}
