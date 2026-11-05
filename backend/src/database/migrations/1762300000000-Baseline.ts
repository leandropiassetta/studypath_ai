import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Baseline: proves the migration pipeline works on an empty database. Tables arrive in T03. */
export class Baseline1762300000000 implements MigrationInterface {
  name = 'Baseline1762300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  }

  public async down(): Promise<void> {
    // Extension is intentionally kept: other objects may depend on it.
  }
}
