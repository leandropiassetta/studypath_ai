import type { DataSource } from 'typeorm';
import { createDataSource } from '../../src/database/data-source.js';
import { seed } from '../../src/database/seeds/seed.js';

// Isolated database created by docker/init-test-db.sql. Never points at the dev DB.
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://studypath:studypath@127.0.0.1:5432/studypath_test';

/**
 * Tests wipe the whole `public` schema, so refuse anything that does not look like a local,
 * disposable test database. A wrong TEST_DATABASE_URL must never erase real data.
 */
export function assertSafeTestDatabaseUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Refusing to run: TEST_DATABASE_URL is not a valid URL');
  }
  const database = parsed.pathname.replace(/^\//, '');
  const local = ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(parsed.hostname);
  if (!local || !/_test$/.test(database)) {
    throw new Error(
      `Refusing to wipe "${database}" on "${parsed.hostname}": tests only run against a local ` +
        'database whose name ends with "_test".',
    );
  }
}

/** Empty schema (no migrations) on the isolated test database. */
export async function createEmptyTestDb(): Promise<DataSource> {
  assertSafeTestDatabaseUrl(TEST_DATABASE_URL);
  const ds = createDataSource(TEST_DATABASE_URL);
  await ds.initialize();
  await ds.query('DROP SCHEMA IF EXISTS public CASCADE');
  await ds.query('CREATE SCHEMA public');
  return ds;
}

/** Fresh schema + migrations + seed on the isolated test database. */
export async function createSeededTestDb(): Promise<DataSource> {
  const ds = await createEmptyTestDb();
  await ds.runMigrations();
  await seed(ds);
  return ds;
}
