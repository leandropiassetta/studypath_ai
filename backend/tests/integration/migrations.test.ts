import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DataSource } from 'typeorm';
import { createDataSource } from '../../src/database/data-source.js';

// Isolated database created by docker/init-test-db.sql. Never points at the dev DB.
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://studypath:studypath@127.0.0.1:5432/studypath_test';

let ds: DataSource;

beforeAll(async () => {
  ds = createDataSource(TEST_DATABASE_URL);
  await ds.initialize();
  await ds.query('DROP SCHEMA public CASCADE');
  await ds.query('CREATE SCHEMA public');
});

afterAll(async () => {
  await ds.destroy();
});

describe('migrations on an empty database', () => {
  it('apply without error and are recorded', async () => {
    const applied = await ds.runMigrations();
    expect(applied.map((m) => m.name)).toEqual([
      'Baseline1762300000000',
      'CreateCoreSchema1762300001000',
      'AddQuizKind1762300002000',
    ]);
    const rows = await ds.query('SELECT name FROM migrations');
    expect(rows).toHaveLength(3);
  });

  it('are idempotent on a second run', async () => {
    expect(await ds.runMigrations()).toHaveLength(0);
  });
});
