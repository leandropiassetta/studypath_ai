import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Student doubts about a wrong answer, and the graded AI hints already given for each. */
export class AddDoubts1762300004000 implements MigrationInterface {
  name = 'AddDoubts1762300004000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE doubts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        attempt_id uuid NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
        question_id uuid NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
        message varchar(300),
        hints_used int NOT NULL DEFAULT 0,
        status varchar(20) NOT NULL DEFAULT 'AI_HINTS',
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_doubts_attempt_question UNIQUE (attempt_id, question_id),
        CONSTRAINT ck_doubts_hints_used CHECK (hints_used BETWEEN 0 AND 3),
        CONSTRAINT ck_doubts_status CHECK (status IN ('AI_HINTS', 'WAITING_TEACHER', 'ANSWERED'))
      )`);
    await q.query('CREATE INDEX idx_doubts_student_id ON doubts (student_id)');
    await q.query(`
      CREATE TABLE doubt_hints (
        doubt_id uuid NOT NULL REFERENCES doubts(id) ON DELETE CASCADE,
        level int NOT NULL,
        text text NOT NULL,
        source varchar(10) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT pk_doubt_hints PRIMARY KEY (doubt_id, level),
        CONSTRAINT ck_doubt_hints_level CHECK (level BETWEEN 1 AND 3),
        CONSTRAINT ck_doubt_hints_source CHECK (source IN ('llm', 'reference'))
      )`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE IF EXISTS doubt_hints');
    await q.query('DROP TABLE IF EXISTS doubts');
  }
}
