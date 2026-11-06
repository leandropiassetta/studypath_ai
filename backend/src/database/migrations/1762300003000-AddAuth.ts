import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Real authentication: credentials on students and server-side sessions (token hashes only). */
export class AddAuth1762300003000 implements MigrationInterface {
  name = 'AddAuth1762300003000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE students ADD COLUMN email varchar(254)');
    await q.query('ALTER TABLE students ADD COLUMN password_hash text');
    await q.query('ALTER TABLE students ADD CONSTRAINT uq_students_email UNIQUE (email)');
    // Either both credentials exist or neither does (the seeded demo student has none).
    await q.query(
      `ALTER TABLE students ADD CONSTRAINT ck_students_credentials
         CHECK ((email IS NULL) = (password_hash IS NULL))`,
    );
    await q.query(`
      CREATE TABLE sessions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        token_hash char(64) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL,
        CONSTRAINT uq_sessions_token_hash UNIQUE (token_hash)
      )`);
    await q.query('CREATE INDEX idx_sessions_student_id ON sessions (student_id)');
    await q.query('CREATE INDEX idx_sessions_expires_at ON sessions (expires_at)');
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE IF EXISTS sessions');
    await q.query('ALTER TABLE students DROP CONSTRAINT IF EXISTS ck_students_credentials');
    await q.query('ALTER TABLE students DROP CONSTRAINT IF EXISTS uq_students_email');
    await q.query('ALTER TABLE students DROP COLUMN IF EXISTS password_hash');
    await q.query('ALTER TABLE students DROP COLUMN IF EXISTS email');
  }
}
