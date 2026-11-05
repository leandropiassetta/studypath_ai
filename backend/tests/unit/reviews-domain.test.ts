import { describe, expect, it } from 'vitest';
import { composeReviewSelection, reviewSlug } from '../../src/modules/reviews/domain.js';
import type { CandidateQuestion } from '../../src/modules/recommendations/domain.js';

const q = (
  id: string,
  difficulty: CandidateQuestion['difficulty'],
  day: number,
): CandidateQuestion => ({
  id,
  difficulty,
  createdAt: new Date(Date.UTC(2026, 0, day)),
});

describe('composeReviewSelection', () => {
  it('uses up to 3 unseen questions in RN-08 order and no retries when enough exist', () => {
    const r = composeReviewSelection(
      [q('h', 'hard', 1), q('e2', 'easy', 2), q('m', 'medium', 1), q('e1', 'easy', 1)],
      [q('w', 'easy', 1)],
    );
    expect(r).toEqual({ questionIds: ['e1', 'e2', 'm'], newCount: 3, retryCount: 0 });
  });

  it('tops up with still-wrong questions when fewer than 3 unseen exist', () => {
    const r = composeReviewSelection(
      [q('n1', 'easy', 1)],
      [q('w2', 'hard', 1), q('w1', 'easy', 1), q('w3', 'medium', 1)],
    );
    expect(r).toEqual({ questionIds: ['n1', 'w1', 'w3'], newCount: 1, retryCount: 2 });
  });

  it('retries only when there is nothing new, capped at 3', () => {
    const r = composeReviewSelection(
      [],
      [q('a', 'easy', 1), q('b', 'easy', 2), q('c', 'medium', 1), q('d', 'hard', 1)],
    );
    expect(r).toEqual({ questionIds: ['a', 'b', 'c'], newCount: 0, retryCount: 3 });
  });

  it('never repeats a question that is both unseen and listed as wrong', () => {
    const r = composeReviewSelection([q('x', 'easy', 1)], [q('x', 'easy', 1), q('y', 'easy', 2)]);
    expect(r.questionIds).toEqual(['x', 'y']);
  });

  it('is empty when there is nothing to practice', () => {
    expect(composeReviewSelection([], [])).toEqual({ questionIds: [], newCount: 0, retryCount: 0 });
  });
});

describe('reviewSlug', () => {
  it('is stable, order-independent and a valid quiz slug', () => {
    expect(reviewSlug(['b', 'a', 'c'])).toBe(reviewSlug(['c', 'a', 'b']));
    expect(reviewSlug(['a', 'b'])).not.toBe(reviewSlug(['a', 'c']));
    expect(reviewSlug(['a'])).toMatch(/^revisao-[0-9a-f]{16}$/);
  });
});
