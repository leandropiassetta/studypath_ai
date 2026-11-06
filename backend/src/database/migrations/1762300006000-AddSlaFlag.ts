import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Set by the delayed background job when a doubt is still waiting past the promised time. */
export class AddSlaFlag1762300006000 implements MigrationInterface {
  name = 'AddSlaFlag1762300006000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE doubts ADD COLUMN sla_breached_at timestamptz');
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE doubts DROP COLUMN sla_breached_at');
  }
}
