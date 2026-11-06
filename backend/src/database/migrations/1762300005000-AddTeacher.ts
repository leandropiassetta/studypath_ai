import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Teacher accounts, the "call a teacher" request, the teacher's answer and the student's feedback. */
export class AddTeacher1762300005000 implements MigrationInterface {
  name = 'AddTeacher1762300005000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE students ADD COLUMN role varchar(10) NOT NULL DEFAULT 'student'`);
    await q.query(
      `ALTER TABLE students ADD CONSTRAINT ck_students_role CHECK (role IN ('student', 'teacher'))`,
    );
    await q.query('ALTER TABLE doubts ADD COLUMN teacher_requested_at timestamptz');
    await q.query('ALTER TABLE doubts ADD COLUMN teacher_answer text');
    await q.query('ALTER TABLE doubts ADD COLUMN answered_at timestamptz');
    await q.query(
      'ALTER TABLE doubts ADD COLUMN answered_by uuid REFERENCES students(id) ON DELETE SET NULL',
    );
    await q.query('ALTER TABLE doubts ADD COLUMN ai_helpful boolean');
    await q.query('ALTER TABLE doubts ADD COLUMN teacher_helpful boolean');
    // Probable misconception and topic, filled in by the background job when it exists.
    await q.query('ALTER TABLE doubts ADD COLUMN misconception varchar(300)');
    await q.query(`
      ALTER TABLE doubts
        ADD CONSTRAINT ck_doubts_waiting CHECK (status = 'AI_HINTS' OR teacher_requested_at IS NOT NULL),
        ADD CONSTRAINT ck_doubts_answered CHECK ((status = 'ANSWERED') = (teacher_answer IS NOT NULL))`);
    await q.query(
      'CREATE INDEX idx_doubts_status_requested ON doubts (status, teacher_requested_at)',
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query('DROP INDEX IF EXISTS idx_doubts_status_requested');
    await q.query('ALTER TABLE doubts DROP CONSTRAINT IF EXISTS ck_doubts_answered');
    await q.query('ALTER TABLE doubts DROP CONSTRAINT IF EXISTS ck_doubts_waiting');
    for (const column of [
      'misconception',
      'teacher_helpful',
      'ai_helpful',
      'answered_by',
      'answered_at',
      'teacher_answer',
      'teacher_requested_at',
    ]) {
      await q.query(`ALTER TABLE doubts DROP COLUMN IF EXISTS ${column}`);
    }
    await q.query('ALTER TABLE students DROP CONSTRAINT IF EXISTS ck_students_role');
    await q.query('ALTER TABLE students DROP COLUMN IF EXISTS role');
  }
}
