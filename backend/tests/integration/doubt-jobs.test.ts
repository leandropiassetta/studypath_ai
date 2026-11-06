import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { DEMO_QUIZ_ID } from '../../src/database/seeds/data.js';
import { ExplanationRepository } from '../../src/modules/ai/repository.js';
import { MockExplanationProvider } from '../../src/modules/ai/providers/mock.js';
import type { AnalysisInput, ExplanationProvider } from '../../src/modules/ai/providers/types.js';
import {
  createDoubtQueue,
  processEnrich,
  processSla,
  type DoubtQueue,
  type JobDeps,
} from '../../src/modules/doubts/jobs.js';
import { DoubtRepository } from '../../src/modules/doubts/repository.js';
import { DoubtService } from '../../src/modules/doubts/service.js';
import { createSeededTestDb } from '../helpers/test-db.js';

const REDIS_URL = process.env.TEST_REDIS_URL ?? 'redis://127.0.0.1:6379';
const Q2 = '22222222-2222-4222-8222-000000000002';
const silent = { info: () => undefined, warn: () => undefined };

let ds: DataSource;
let doubts: DoubtRepository;
let answers: ExplanationRepository;
const queues: DoubtQueue[] = [];

/** A student, a wrong attempt and a doubt, straight in the database. */
async function newDoubt(message: string | null = null): Promise<string> {
  const [student] = await ds.query(
    `INSERT INTO students (name, email, password_hash) VALUES ('Aluno Job', $1, 'x') RETURNING id`,
    [`job-${randomUUID().slice(0, 8)}@teste.dev`],
  );
  const [attempt] = await ds.query(
    `INSERT INTO attempts (student_id, quiz_id, request_id, payload_hash, total_count, correct_count, score_pct)
     VALUES ($1, $2, $3, $4, 1, 0, 0) RETURNING id`,
    [student.id, DEMO_QUIZ_ID, randomUUID(), randomUUID()],
  );
  await ds.query(
    `INSERT INTO attempt_answers (attempt_id, question_id, selected_option, is_correct) VALUES ($1, $2, 'A', false)`,
    [attempt.id, Q2],
  );
  const { doubt } = await doubts.openOrGet({
    studentId: student.id,
    attemptId: attempt.id,
    questionId: Q2,
    message,
  });
  return doubt.id;
}

const misconceptionOf = async (id: string): Promise<string | null> =>
  (await ds.query('SELECT misconception FROM doubts WHERE id = $1', [id]))[0].misconception;

async function eventually<T>(read: () => Promise<T>, done: (v: T) => boolean): Promise<T> {
  let value = await read();
  for (let i = 0; i < 100 && !done(value); i++) {
    await new Promise((r) => setTimeout(r, 100));
    value = await read();
  }
  return value;
}

const deps = (provider: ExplanationProvider | null): JobDeps => ({
  doubts,
  answers,
  provider,
  timeoutMs: 1000,
  log: silent,
});

beforeAll(async () => {
  ds = await createSeededTestDb();
  doubts = new DoubtRepository(ds);
  answers = new ExplanationRepository(ds);
});

afterAll(async () => {
  await Promise.all(queues.map((q) => q.close()));
  await ds.destroy();
});

describe('processEnrich', () => {
  it('stores the model analysis and never overwrites it', async () => {
    const id = await newDoubt();
    await processEnrich(deps(new MockExplanationProvider()), id, false);
    const first = await misconceptionOf(id);
    expect(first).toContain('[mock]');

    const other: ExplanationProvider = {
      explain: async () => ({}),
      analyze: async () => ({ misconception: 'outra coisa' }),
    };
    await processEnrich(deps(other), id, false);
    expect(await misconceptionOf(id)).toBe(first); // a repeated job changes nothing
  });

  it('sends the student message to the model as data and rejects invalid output', async () => {
    const id = await newDoubt('não entendi o passo');
    let seen: AnalysisInput | undefined;
    const provider: ExplanationProvider = {
      explain: async () => ({}),
      analyze: async (input) => {
        seen = input;
        return { misconception: 'x'.repeat(301) }; // too long: invalid
      },
    };
    await expect(processEnrich(deps(provider), id, false)).rejects.toThrow(/rejected/);
    expect(seen?.studentMessage).toBe('não entendi o passo');
    expect(await misconceptionOf(id)).toBeNull();
  });

  it('falls back to a plain sentence on the last attempt, or when there is no model', async () => {
    const failing: ExplanationProvider = {
      explain: async () => ({}),
      analyze: async () => {
        throw new Error('boom');
      },
    };
    const a = await newDoubt();
    await processEnrich(deps(failing), a, true);
    expect(await misconceptionOf(a)).toBe('Marcou A em vez de B.');

    const b = await newDoubt();
    await processEnrich(deps(null), b, false);
    expect(await misconceptionOf(b)).toBe('Marcou A em vez de B.');
  });
});

describe('processSla', () => {
  it('flags only doubts still waiting, and only once', async () => {
    const waiting = await newDoubt();
    await ds.query(
      `UPDATE doubts SET status = 'WAITING_TEACHER', teacher_requested_at = now() WHERE id = $1`,
      [waiting],
    );
    const aiOnly = await newDoubt();
    await processSla(deps(null), waiting);
    await processSla(deps(null), aiOnly);
    const flagged = async (id: string) =>
      (await ds.query('SELECT sla_breached_at FROM doubts WHERE id = $1', [id]))[0]
        .sla_breached_at as Date | null;
    const first = await flagged(waiting);
    expect(first).not.toBeNull();
    expect(await flagged(aiOnly)).toBeNull();
    await processSla(deps(null), waiting);
    expect(await flagged(waiting)).toEqual(first);
  });
});

describe('BullMQ with a real Redis', () => {
  const start = (provider: ExplanationProvider | null, slaDelayMs = 60_000) => {
    const q = createDoubtQueue({
      redisUrl: REDIS_URL,
      slaDelayMs,
      backoffMs: 50,
      queueName: `test-${randomUUID()}`,
      deps: deps(provider),
    });
    queues.push(q);
    return q;
  };

  it('retries with backoff until the model answers', async () => {
    let calls = 0;
    const flaky: ExplanationProvider = {
      explain: async () => ({}),
      analyze: async () => {
        calls += 1;
        if (calls < 3) throw new Error('temporary');
        return { misconception: 'Confundiu os lados da equação.' };
      },
    };
    const q = start(flaky);
    const id = await newDoubt();
    await q.jobs.onTeacherRequested(id);
    expect(
      await eventually(
        () => misconceptionOf(id),
        (v) => v !== null,
      ),
    ).toBe('Confundiu os lados da equação.');
    expect(calls).toBe(3);
  });

  it('degrades to the plain sentence when the model never comes back', async () => {
    let calls = 0;
    const down: ExplanationProvider = {
      explain: async () => ({}),
      analyze: async () => {
        calls += 1;
        throw new Error('down');
      },
    };
    const q = start(down);
    const id = await newDoubt();
    await q.jobs.onTeacherRequested(id);
    expect(
      await eventually(
        () => misconceptionOf(id),
        (v) => v !== null,
      ),
    ).toBe('Marcou A em vez de B.');
    expect(calls).toBe(3); // exactly the configured attempts
  });

  it('does not run twice when the teacher is called twice (job id = doubt id)', async () => {
    let calls = 0;
    const counting: ExplanationProvider = {
      explain: async () => ({}),
      analyze: async () => {
        calls += 1;
        return { misconception: 'ok' };
      },
    };
    const q = start(counting);
    const id = await newDoubt();
    await Promise.all([q.jobs.onTeacherRequested(id), q.jobs.onTeacherRequested(id)]);
    await eventually(
      () => misconceptionOf(id),
      (v) => v !== null,
    );
    await new Promise((r) => setTimeout(r, 300));
    expect(calls).toBe(1);
  });

  it('flags the doubt when the delayed SLA job fires', async () => {
    const q = start(null, 300);
    const id = await newDoubt();
    await ds.query(
      `UPDATE doubts SET status = 'WAITING_TEACHER', teacher_requested_at = now() WHERE id = $1`,
      [id],
    );
    await q.jobs.onTeacherRequested(id);
    const at = await eventually(
      async () =>
        (await ds.query('SELECT sla_breached_at FROM doubts WHERE id = $1', [id]))[0]
          .sla_breached_at as Date | null,
      (v) => v !== null,
    );
    expect(at).not.toBeNull();
  });

  it('never fails the request when Redis is unreachable', async () => {
    const q = createDoubtQueue({
      redisUrl: 'redis://127.0.0.1:1', // nothing listens here
      slaDelayMs: 60_000,
      queueName: `test-${randomUUID()}`,
      deps: deps(null),
    });
    queues.push(q);
    await expect(q.jobs.onTeacherRequested(randomUUID())).resolves.toBeUndefined();
  });
});

describe('DoubtService with jobs', () => {
  it('enqueues once on the first call to a teacher, not on repeats', async () => {
    const calls: string[] = [];
    const service = new DoubtService(doubts, answers, null, 1000, undefined, undefined, {
      onTeacherRequested: async (id) => void calls.push(id),
    });
    const id = await newDoubt();
    const [{ student_id: studentId }] = await ds.query(
      'SELECT student_id FROM doubts WHERE id = $1',
      [id],
    );
    await service.requestTeacher(studentId, id);
    await service.requestTeacher(studentId, id);
    expect(calls).toEqual([id]);
  });
});
