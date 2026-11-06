import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DataSource } from 'typeorm';
import { createEmptyTestDb } from '../helpers/test-db.js';

let ds: DataSource;

beforeAll(async () => {
  ds = await createEmptyTestDb();
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
      'AddAuth1762300003000',
    ]);
    const rows = await ds.query('SELECT name FROM migrations');
    expect(rows).toHaveLength(4);
  });

  it('are idempotent on a second run', async () => {
    expect(await ds.runMigrations()).toHaveLength(0);
  });
});
