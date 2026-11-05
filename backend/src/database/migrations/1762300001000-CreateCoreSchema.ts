import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCoreSchema1762300001000 implements MigrationInterface {
  name = 'CreateCoreSchema1762300001000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE students (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar(120) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`
      CREATE TABLE topics (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar(120) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_topics_name UNIQUE (name)
      )`);
    await q.query(`
      CREATE TABLE quizzes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        slug varchar(120) NOT NULL,
        title varchar(200) NOT NULL,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_quizzes_slug UNIQUE (slug)
      )`);
    await q.query(`
      CREATE TABLE questions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE RESTRICT,
        statement text NOT NULL,
        options jsonb NOT NULL,
        correct_option varchar(8) NOT NULL,
        difficulty varchar(10) NOT NULL,
        reference_explanation text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_questions_difficulty CHECK (difficulty IN ('easy', 'medium', 'hard')),
        CONSTRAINT ck_questions_options_array CHECK (
          jsonb_typeof(options) = 'array' AND jsonb_array_length(options) >= 2
        ),
        CONSTRAINT ck_questions_correct_in_options CHECK (
          options @> jsonb_build_array(jsonb_build_object('key', correct_option))
        )
      )`);
    await q.query('CREATE INDEX idx_questions_topic_id ON questions (topic_id)');
    await q.query(`
      CREATE TABLE quiz_questions (
        quiz_id uuid NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
        question_id uuid NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
        position int NOT NULL,
        CONSTRAINT pk_quiz_questions PRIMARY KEY (quiz_id, question_id),
        CONSTRAINT uq_quiz_questions_position UNIQUE (quiz_id, position),
        CONSTRAINT ck_quiz_questions_position CHECK (position >= 1)
      )`);
    await q.query('CREATE INDEX idx_quiz_questions_question_id ON quiz_questions (question_id)');
    await q.query(`
      CREATE TABLE attempts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id uuid NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
        quiz_id uuid NOT NULL REFERENCES quizzes(id) ON DELETE RESTRICT,
        request_id uuid NOT NULL,
        payload_hash char(64) NOT NULL,
        correct_count int NOT NULL,
        total_count int NOT NULL,
        score_pct numeric(5,2) NOT NULL,
        submitted_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_attempts_student_request UNIQUE (student_id, request_id),
        CONSTRAINT ck_attempts_counts CHECK (
          total_count > 0 AND correct_count >= 0 AND correct_count <= total_count
        ),
        CONSTRAINT ck_attempts_score CHECK (score_pct >= 0 AND score_pct <= 100)
      )`);
    await q.query(
      'CREATE INDEX idx_attempts_student_submitted ON attempts (student_id, submitted_at)',
    );
    await q.query('CREATE INDEX idx_attempts_quiz_id ON attempts (quiz_id)');
    await q.query(`
      CREATE TABLE attempt_answers (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        attempt_id uuid NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
        question_id uuid NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
        selected_option varchar(8) NOT NULL,
        is_correct boolean NOT NULL,
        CONSTRAINT uq_attempt_answers_attempt_question UNIQUE (attempt_id, question_id)
      )`);
    await q.query('CREATE INDEX idx_attempt_answers_question_id ON attempt_answers (question_id)');
  }

  public async down(q: QueryRunner): Promise<void> {
    for (const table of [
      'attempt_answers',
      'attempts',
      'quiz_questions',
      'questions',
      'quizzes',
      'topics',
      'students',
    ]) {
      await q.query(`DROP TABLE IF EXISTS ${table}`);
    }
  }
}
