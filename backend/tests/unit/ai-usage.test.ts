import { describe, expect, it, vi } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';
import { ExplanationCache, UsageLimiter } from '../../src/modules/ai/usage.js';
import { ExplanationService } from '../../src/modules/ai/service.js';
import type {
  ExplanationInput,
  ExplanationProvider,
} from '../../src/modules/ai/providers/types.js';
import type { ExplanationRepository } from '../../src/modules/ai/repository.js';

const MIN = 60_000;
const DAY = 24 * 60 * MIN;

describe('UsageLimiter', () => {
  it('allows up to the per-minute limit, then refuses until the window slides', () => {
    let t = 0;
    const limiter = new UsageLimiter({ perMinute: 2, perDay: 100 }, () => t);
    expect(limiter.tryAcquire('s')).toBe('ok');
    expect(limiter.tryAcquire('s')).toBe('ok');
    expect(limiter.tryAcquire('s')).toBe('minute');
    t = 30_000;
    expect(limiter.tryAcquire('s')).toBe('minute');
    t = MIN + 1;
    expect(limiter.tryAcquire('s')).toBe('ok');
  });

  it('enforces the daily limit across minutes and releases it after 24 h', () => {
    let t = 0;
    const limiter = new UsageLimiter({ perMinute: 10, perDay: 3 }, () => t);
    for (let i = 0; i < 3; i += 1) {
      t = i * 5 * MIN;
      expect(limiter.tryAcquire('s')).toBe('ok');
    }
    t = 20 * MIN;
    expect(limiter.tryAcquire('s')).toBe('day');
    t = DAY + 1;
    expect(limiter.tryAcquire('s')).toBe('ok');
  });

  it('keeps students independent and does not count refused calls', () => {
    let t = 0;
    const limiter = new UsageLimiter({ perMinute: 1, perDay: 100 }, () => t);
    expect(limiter.tryAcquire('a')).toBe('ok');
    expect(limiter.tryAcquire('a')).toBe('minute');
    expect(limiter.tryAcquire('b')).toBe('ok');
    t = MIN + 1; // only the one accepted call of 'a' was recorded, so it frees up exactly now
    expect(limiter.tryAcquire('a')).toBe('ok');
  });
});

describe('ExplanationCache', () => {
  it('returns stored values until the TTL passes', () => {
    let t = 0;
    const cache = new ExplanationCache(10, 1000, () => t);
    cache.set('k', 'v');
    expect(cache.get('k')).toBe('v');
    t = 999;
    expect(cache.get('k')).toBe('v');
    t = 1000;
    expect(cache.get('k')).toBeUndefined();
  });

  it('evicts the oldest entry beyond the size cap', () => {
    const cache = new ExplanationCache(2, 1000, () => 0);
    cache.set('a', '1');
    cache.set('b', '2');
    cache.set('c', '3');
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe('2');
    expect(cache.get('c')).toBe('3');
  });
});

describe('ExplanationService cost guards', () => {
  const log = { warn: vi.fn() } as unknown as FastifyBaseLogger;
  const DEMO = 'demo-student';
  const input: ExplanationInput = {
    statement: 's',
    options: [{ key: 'A', text: '1' }],
    selectedOption: 'A',
    correctOption: 'B',
    referenceExplanation: 'ref',
  };
  const repo = {
    findAnswer: async () => ({
      found: 'answer' as const,
      context: { ...input, studentId: DEMO, isCorrect: false },
    }),
  } as unknown as ExplanationRepository;

  const counting = (): { provider: ExplanationProvider; calls: () => number } => {
    let n = 0;
    return {
      provider: {
        explain: async () => {
          n += 1;
          return { explanation: `texto ${n}` };
        },
      },
      calls: () => n,
    };
  };

  it('serves repeated requests for the same question from the cache (one LLM call)', async () => {
    const { provider, calls } = counting();
    const svc = new ExplanationService(repo, DEMO, provider, 1000);
    const first = await svc.explain('a1', 'q1', log);
    const second = await svc.explain('a1', 'q1', log);
    expect(first).toEqual(second);
    expect(second.source).toBe('llm');
    expect(calls()).toBe(1);
    await svc.explain('a1', 'q2', log); // another question is a new call
    expect(calls()).toBe(2);
  });

  it('shares one LLM call between concurrent identical requests', async () => {
    let n = 0;
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const provider: ExplanationProvider = {
      explain: async () => {
        n += 1;
        await gate;
        return { explanation: 'texto' };
      },
    };
    const svc = new ExplanationService(repo, DEMO, provider, 5000);
    const all = Promise.all(Array.from({ length: 8 }, () => svc.explain('a1', 'q1', log)));
    await new Promise((r) => setTimeout(r, 20));
    release();
    const results = await all;
    expect(n).toBe(1);
    expect(new Set(results.map((r) => r.explanation)).size).toBe(1);
  });

  it('past the limit it returns the reference with a notice and never calls the LLM', async () => {
    const { provider, calls } = counting();
    const svc = new ExplanationService(repo, DEMO, provider, 1000, { perMinute: 2, perDay: 50 });
    await svc.explain('a1', 'q1', log);
    await svc.explain('a1', 'q2', log);
    const limited = await svc.explain('a1', 'q3', log);
    expect(limited).toMatchObject({ source: 'reference', explanation: 'ref' });
    expect(limited.notice).toMatch(/pouco tempo/);
    expect(calls()).toBe(2);
    // Cached answers keep working while limited, at no cost.
    expect((await svc.explain('a1', 'q1', log)).source).toBe('llm');
    expect(calls()).toBe(2);
  });

  it('daily limit uses its own notice', async () => {
    const { provider } = counting();
    const svc = new ExplanationService(repo, DEMO, provider, 1000, { perMinute: 100, perDay: 1 });
    await svc.explain('a1', 'q1', log);
    const limited = await svc.explain('a1', 'q2', log);
    expect(limited.notice).toMatch(/24 h/);
  });

  it('failed calls count toward the limit and are not cached', async () => {
    let n = 0;
    const provider: ExplanationProvider = {
      explain: async () => {
        n += 1;
        throw new Error('503');
      },
    };
    const svc = new ExplanationService(repo, DEMO, provider, 1000, { perMinute: 2, perDay: 50 });
    expect((await svc.explain('a1', 'q1', log)).source).toBe('reference');
    expect((await svc.explain('a1', 'q1', log)).source).toBe('reference'); // retried, not cached
    expect(n).toBe(2);
    const limited = await svc.explain('a1', 'q1', log);
    expect(limited.notice).toBeDefined();
    expect(n).toBe(2); // a failing provider cannot be hammered
  });

  it('a limited or fallback answer carries no notice when AI is simply disabled', async () => {
    const svc = new ExplanationService(repo, DEMO, null, 1000);
    expect(await svc.explain('a1', 'q1', log)).toEqual({
      questionId: 'q1',
      explanation: 'ref',
      source: 'reference',
    });
  });
});
