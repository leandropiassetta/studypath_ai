import { loadEnv } from '../../config/env.js';
import { hashPassword } from '../../modules/auth/password.js';
import { MIN_PASSWORD_LENGTH } from '../../modules/auth/schemas.js';
import { createDataSource } from '../data-source.js';
import { seed, type SeedOptions } from './seed.js';

/** Credentials for the demo student come only from the environment, never from the repository. */
async function demoCredentialsFromEnv(): Promise<SeedOptions['demoCredentials']> {
  const email = process.env.DEMO_EMAIL?.trim().toLowerCase();
  const password = process.env.DEMO_PASSWORD;
  if (!email && !password) return undefined;
  if (!email || !password) throw new Error('Set both DEMO_EMAIL and DEMO_PASSWORD, or neither');
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`DEMO_PASSWORD must have at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  return { email, passwordHash: await hashPassword(password) };
}

/** Same rule for the teacher: credentials only from the environment, never from the repository. */
async function teacherFromEnv(): Promise<SeedOptions['teacher']> {
  const email = process.env.TEACHER_EMAIL?.trim().toLowerCase();
  const password = process.env.TEACHER_PASSWORD;
  if (!email && !password) return undefined;
  if (!email || !password)
    throw new Error('Set both TEACHER_EMAIL and TEACHER_PASSWORD, or neither');
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`TEACHER_PASSWORD must have at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  return {
    name: process.env.TEACHER_NAME?.trim() || 'Professor(a)',
    email,
    passwordHash: await hashPassword(password),
  };
}

const ds = createDataSource(loadEnv().DATABASE_URL);
await ds.initialize();
try {
  const demoCredentials = await demoCredentialsFromEnv();
  const teacher = await teacherFromEnv();
  await seed(ds, { demoCredentials, teacher });
  console.log(
    `Seed applied (demo account ${demoCredentials ? 'can' : 'cannot'} log in; teacher ${teacher ? 'created' : 'not created'})`,
  );
} finally {
  await ds.destroy();
}
