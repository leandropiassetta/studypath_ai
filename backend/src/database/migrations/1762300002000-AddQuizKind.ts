import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Distinguishes the demo/standard quiz from generated review quizzes. */
export class AddQuizKind1762300002000 implements MigrationInterface {
  name = 'AddQuizKind1762300002000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE quizzes ADD COLUMN kind varchar(10) NOT NULL DEFAULT 'standard'`);
    await q.query(
      `ALTER TABLE quizzes ADD CONSTRAINT ck_quizzes_kind CHECK (kind IN ('standard', 'review'))`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE quizzes DROP CONSTRAINT ck_quizzes_kind');
    await q.query('ALTER TABLE quizzes DROP COLUMN kind');
  }
}
