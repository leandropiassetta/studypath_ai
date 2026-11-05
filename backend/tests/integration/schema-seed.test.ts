import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DataSource } from 'typeorm';
import { createDataSource } from '../../src/database/data-source.js';
import { Question, Quiz, QuizQuestion } from '../../src/database/entities/index.js';
import { seed } from '../../src/database/seeds/seed.js';
import {
  DEMO_QUIZ_ID,
  DEMO_QUIZ_SLUG,
  DEMO_STUDENT_ID,
  TOPIC_EQUACOES_ID,
} from '../../src/database/seeds/data.js';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://studypath:studypath@127.0.0.1:5432/studypath_test';

let ds: DataSource;

beforeAll(async () => {
  ds = createDataSource(TEST_DATABASE_URL);
  await ds.initialize();
  await ds.query('DROP SCHEMA public CASCADE');
  await ds.query('CREATE SCHEMA public');
  await ds.runMigrations();
  await seed(ds);
});

afterAll(async () => {
  await ds.destroy();
});

const count = async (sql: string): Promise<number> =>
  Number((await ds.query<{ n: string }[]>(sql))[0]?.n);

describe('schema', () => {
  it('creates the 7 core tables', async () => {
    const rows = await ds.query<{ table_name: string }[]>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name <> 'migrations' ORDER BY table_name`,
    );
    expect(rows.map((r) => r.table_name)).toEqual([
      'attempt_answers',
      'attempts',
      'questions',
      'quiz_questions',
      'quizzes',
      'students',
      'topics',
    ]);
  });

  it.each([
    ['invalid difficulty', `UPDATE questions SET difficulty = 'impossible'`],
    ['correct_option missing from options', `UPDATE questions SET correct_option = 'Z'`],
    ['duplicate topic name', `INSERT INTO topics (name) VALUES ('Equações')`],
    ['duplicate quiz position', `UPDATE quiz_questions SET position = 1 WHERE position = 2`],
    [
      'non-existent FK',
      `INSERT INTO quiz_questions VALUES (gen_random_uuid(), gen_random_uuid(), 99)`,
    ],
  ])('rejects %s', async (_name, sql) => {
    await expect(ds.query(sql)).rejects.toThrow();
  });

  it('enforces attempts uniqueness and count checks', async () => {
    const insert = (requestId: string, correct: number): Promise<unknown> =>
      ds.query(
        `INSERT INTO attempts (student_id, quiz_id, request_id, payload_hash, correct_count, total_count, score_pct)
         VALUES ($1, $2, $3, repeat('a', 64), $4, 8, 50)`,
        [DEMO_STUDENT_ID, DEMO_QUIZ_ID, requestId, correct],
      );
    const rid = '44444444-4444-4444-8444-444444444444';
    await insert(rid, 4);
    await expect(insert(rid, 4)).rejects.toThrow(/uq_attempts_student_request/);
    await expect(insert('44444444-4444-4444-8444-444444444445', 9)).rejects.toThrow(
      /ck_attempts_counts/,
    );
    await ds.query('DELETE FROM attempts');
  });
});

describe('seed', () => {
  it('creates the demo student, 2 topics and the active demo quiz', async () => {
    expect(await count('SELECT count(*) n FROM students')).toBe(1);
    expect(await count('SELECT count(*) n FROM topics')).toBe(2);
    const quiz = await ds.getRepository(Quiz).findOneByOrFail({ slug: DEMO_QUIZ_SLUG });
    expect(quiz.isActive).toBe(true);
  });

  it('has 8 ordered quiz questions, 4 per topic, plus 6 extras', async () => {
    const links = await ds.getRepository(QuizQuestion).find({ order: { position: 'ASC' } });
    expect(links.map((l) => l.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(await count('SELECT count(*) n FROM questions')).toBe(14);
    expect(
      await count(
        `SELECT count(*) n FROM questions q WHERE NOT EXISTS
         (SELECT 1 FROM quiz_questions qq WHERE qq.question_id = q.id)`,
      ),
    ).toBe(6);
    const perTopic = await ds.query<{ topic_id: string; n: string }[]>(
      `SELECT q.topic_id, count(*) n FROM quiz_questions qq
       JOIN questions q ON q.id = qq.question_id GROUP BY q.topic_id`,
    );
    expect(perTopic.map((r) => Number(r.n))).toEqual([4, 4]);
  });

  it('every correct option exists in its options (through the entity)', async () => {
    const all = await ds.getRepository(Question).find();
    for (const q of all) expect(q.options.map((o) => o.key)).toContain(q.correctOption);
    expect(all.filter((q) => q.topicId === TOPIC_EQUACOES_ID)).toHaveLength(7);
  });

  it('is idempotent', async () => {
    await seed(ds);
    expect(await count('SELECT count(*) n FROM questions')).toBe(14);
    expect(await count('SELECT count(*) n FROM quiz_questions')).toBe(8);
  });
});
