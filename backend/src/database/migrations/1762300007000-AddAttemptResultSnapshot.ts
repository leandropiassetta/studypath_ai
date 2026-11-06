import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The graded result exactly as the student first saw it (gabarito, explanations, topics, totals).
 * A replay of the same request returns this snapshot instead of re-grading against the CURRENT
 * questions, so editing a question later can never make an old result contradict itself.
 * Attempts made before this migration have NULL and are filled in lazily on their first replay.
 */
export class AddAttemptResultSnapshot1762300007000 implements MigrationInterface {
  name = 'AddAttemptResultSnapshot1762300007000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE attempts ADD COLUMN result jsonb');
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE attempts DROP COLUMN result');
  }
}
