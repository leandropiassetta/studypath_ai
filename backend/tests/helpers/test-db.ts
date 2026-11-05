import type { DataSource } from 'typeorm';
import { createDataSource } from '../../src/database/data-source.js';
import { seed } from '../../src/database/seeds/seed.js';

// Isolated database created by docker/init-test-db.sql. Never points at the dev DB.
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://studypath:studypath@127.0.0.1:5432/studypath_test';

/** Fresh schema + migrations + seed on the isolated test database. */
export async function createSeededTestDb(): Promise<DataSource> {
  const ds = createDataSource(TEST_DATABASE_URL);
  await ds.initialize();
  await ds.query('DROP SCHEMA IF EXISTS public CASCADE');
  await ds.query('CREATE SCHEMA public');
  await ds.runMigrations();
  await seed(ds);
  return ds;
}
