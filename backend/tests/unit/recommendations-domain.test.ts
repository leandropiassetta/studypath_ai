import { describe, expect, it } from 'vitest';
import {
  overallStatus,
  selectPriorityTopics,
  selectSuggestions,
  summarizeByTopic,
  type AnswerFact,
  type CandidateQuestion,
} from '../../src/modules/recommendations/domain.js';

const facts = (topicId: string, name: string, correct: number, wrong: number): AnswerFact[] => [
  ...Array.from({ length: correct }, () => ({ topicId, topicName: name, isCorrect: true })),
  ...Array.from({ length: wrong }, () => ({ topicId, topicName: name, isCorrect: false })),
];

describe('selectPriorityTopics (RN-07)', () => {
  it('flags 1/4 as HIGH and does not flag 3/4', () => {
    const r = selectPriorityTopics([
      ...facts('E', 'Equações', 1, 3),
      ...facts('G', 'Geometria', 3, 1),
    ]);
    expect(r.map((t) => t.topicId)).toEqual(['E']);
    expect(r[0]).toMatchObject({ correctCount: 1, answeredCount: 4, accuracyPct: 25 });
  });

  it('uses a strict 60% limit: 3/5 is not HIGH, 2/5 is, 5/9 (55.6%) is', () => {
    expect(selectPriorityTopics(facts('T', 'T', 3, 2))).toEqual([]);
    expect(selectPriorityTopics(facts('T', 'T', 2, 3))).toHaveLength(1);
    expect(selectPriorityTopics(facts('T', 'T', 5, 4))).toHaveLength(1);
  });

  it('ignores topics with fewer than 2 answers, even at 0%', () => {
    expect(selectPriorityTopics(facts('T', 'T', 0, 1))).toEqual([]);
    expect(selectPriorityTopics(facts('T', 'T', 0, 2))).toHaveLength(1);
  });

  it('orders by accuracy asc, answered desc, name asc (stable and deterministic)', () => {
    const input = [
      ...facts('c', 'Cálculo', 1, 3), // 25%, 4
      ...facts('b', 'Beta', 1, 3), // 25%, 4  (name tiebreak vs Cálculo)
      ...facts('a', 'Alfa', 2, 6), // 25%, 8  (more answers first)
      ...facts('z', 'Zeta', 0, 2), // 0%      (lowest accuracy first)
    ];
    const expected = ['z', 'a', 'b', 'c'];
    expect(selectPriorityTopics(input).map((t) => t.topicId)).toEqual(expected);
    expect(selectPriorityTopics([...input].reverse()).map((t) => t.topicId)).toEqual(expected);
  });

  it('compares accuracy exactly, not by rounded values', () => {
    // 1/3 = 33.33%, 2/6 = 33.33%: equal ratios fall through to answered count
    const r = selectPriorityTopics([...facts('x', 'X', 1, 2), ...facts('y', 'Y', 2, 4)]);
    expect(r.map((t) => t.topicId)).toEqual(['y', 'x']);
  });
});

describe('summarizeByTopic', () => {
  it('rounds accuracy to 2 decimals', () => {
    expect(summarizeByTopic(facts('T', 'T', 1, 2))[0]?.accuracyPct).toBe(33.33);
  });
});

describe('selectSuggestions (RN-08)', () => {
  const q = (
    id: string,
    difficulty: CandidateQuestion['difficulty'],
    day: number,
  ): CandidateQuestion => ({
    id,
    difficulty,
    createdAt: new Date(Date.UTC(2026, 0, day)),
  });

  it('orders by difficulty, then creation date, then id, and returns at most 3', () => {
    const r = selectSuggestions([
      q('h', 'hard', 1),
      q('e2', 'easy', 5),
      q('m', 'medium', 1),
      q('e1b', 'easy', 2),
      q('e1a', 'easy', 2),
    ]);
    expect(r.map((x) => x.id)).toEqual(['e1a', 'e1b', 'e2']);
  });

  it('returns an empty list when there are no candidates and does not mutate input', () => {
    expect(selectSuggestions([])).toEqual([]);
    const input = [q('b', 'hard', 1), q('a', 'easy', 1)];
    selectSuggestions(input);
    expect(input.map((x) => x.id)).toEqual(['b', 'a']);
  });
});

describe('overallStatus (RN-09)', () => {
  it('maps history and priority topics to a status', () => {
    expect(overallStatus(0, 0)).toBe('NO_HISTORY');
    expect(overallStatus(2, 0)).toBe('ON_TRACK');
    expect(overallStatus(1, 1)).toBe('NEEDS_REVIEW');
  });
});
