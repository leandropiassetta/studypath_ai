import { describe, expect, it } from 'vitest';
import { progressAttempts, type AttemptSummary } from '../../src/modules/recommendations/domain.js';

const at = (
  id: string,
  quizId: string,
  kind: 'standard' | 'review' = 'standard',
): AttemptSummary => ({
  id,
  quizId,
  kind,
  submittedAt: new Date(),
  scorePct: 50,
});

describe('progressAttempts', () => {
  it('compares only attempts of the same quiz as the newest full quiz', () => {
    // newest first: history, history, math, review, math
    const list = [
      at('a', 'hist'),
      at('b', 'hist'),
      at('c', 'math'),
      at('r', 'math', 'review'),
      at('d', 'math'),
    ];
    expect(progressAttempts(list, 5).map((a) => a.id)).toEqual(['a', 'b']);
    expect(progressAttempts(list.slice(2), 5).map((a) => a.id)).toEqual(['c', 'd']);
  });

  it('respects the window and ignores reviews entirely', () => {
    const list = [at('a', 'q'), at('b', 'q'), at('c', 'q')];
    expect(progressAttempts(list, 2).map((a) => a.id)).toEqual(['a', 'b']);
    expect(progressAttempts([at('r', 'q', 'review')], 5)).toEqual([]);
    expect(progressAttempts([], 5)).toEqual([]);
  });
});
