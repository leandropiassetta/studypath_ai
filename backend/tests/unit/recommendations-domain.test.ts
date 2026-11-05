import { describe, expect, it } from 'vitest';
import {
  buildProgress,
  latestAnswerPerQuestion,
  overallStatus,
  selectReviewTopics,
  selectSuggestions,
  summarizeByTopic,
  type AnswerFact,
  type AttemptSummary,
  type CandidateQuestion,
  type HistoricAnswer,
} from '../../src/modules/recommendations/domain.js';

const facts = (topicId: string, name: string, correct: number, wrong: number): AnswerFact[] => [
  ...Array.from({ length: correct }, () => ({ topicId, topicName: name, isCorrect: true })),
  ...Array.from({ length: wrong }, () => ({ topicId, topicName: name, isCorrect: false })),
];

describe('selectReviewTopics (RN-07)', () => {
  const priorities = (input: AnswerFact[]) =>
    Object.fromEntries(selectReviewTopics(input).map((t) => [t.topicId, t.priority]));

  it('flags 1/4 as HIGH and 3/4 as LOW (optional review), never HIGH', () => {
    const r = selectReviewTopics([
      ...facts('E', 'Equações', 1, 3),
      ...facts('G', 'Geometria', 3, 1),
    ]);
    expect(r.map((t) => [t.topicId, t.priority])).toEqual([
      ['E', 'HIGH'],
      ['G', 'LOW'],
    ]);
    expect(r[0]).toMatchObject({ correctCount: 1, answeredCount: 4, accuracyPct: 25 });
    expect(r[1]).toMatchObject({ correctCount: 3, answeredCount: 4, accuracyPct: 75 });
  });

  it('uses a strict 60% limit for HIGH: 3/5 is LOW, 2/5 and 5/9 (55.6%) are HIGH', () => {
    expect(priorities(facts('T', 'T', 3, 2))).toEqual({ T: 'LOW' });
    expect(priorities(facts('T', 'T', 2, 3))).toEqual({ T: 'HIGH' });
    expect(priorities(facts('T', 'T', 5, 4))).toEqual({ T: 'HIGH' });
  });

  it('does not recommend topics answered perfectly', () => {
    expect(selectReviewTopics(facts('T', 'T', 4, 0))).toEqual([]);
  });

  it('ignores topics with fewer than 2 answers, even at 0%', () => {
    expect(selectReviewTopics(facts('T', 'T', 0, 1))).toEqual([]);
    expect(priorities(facts('T', 'T', 0, 2))).toEqual({ T: 'HIGH' });
    expect(selectReviewTopics(facts('T', 'T', 1, 0))).toEqual([]);
  });

  it('lists every HIGH topic before any LOW topic, even if a LOW has more answers', () => {
    const r = selectReviewTopics([...facts('l', 'Lógica', 9, 1), ...facts('h', 'Álgebra', 1, 1)]);
    expect(r.map((t) => t.topicId)).toEqual(['h', 'l']);
  });

  it('orders by accuracy asc, answered desc, name asc (stable and deterministic)', () => {
    const input = [
      ...facts('c', 'Cálculo', 1, 3), // 25%, 4
      ...facts('b', 'Beta', 1, 3), // 25%, 4  (name tiebreak vs Cálculo)
      ...facts('a', 'Alfa', 2, 6), // 25%, 8  (more answers first)
      ...facts('z', 'Zeta', 0, 2), // 0%      (lowest accuracy first)
    ];
    const expected = ['z', 'a', 'b', 'c'];
    expect(selectReviewTopics(input).map((t) => t.topicId)).toEqual(expected);
    expect(selectReviewTopics([...input].reverse()).map((t) => t.topicId)).toEqual(expected);
  });

  it('compares accuracy exactly, not by rounded values', () => {
    // 1/3 = 33.33%, 2/6 = 33.33%: equal ratios fall through to answered count
    const r = selectReviewTopics([...facts('x', 'X', 1, 2), ...facts('y', 'Y', 2, 4)]);
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
    expect(overallStatus(2, 1)).toBe('NEEDS_REVIEW'); // a LOW topic alone is enough
    expect(overallStatus(1, 1)).toBe('NEEDS_REVIEW');
  });
});

const ans = (
  attemptId: string,
  questionId: string,
  isCorrect: boolean,
  topic: 'E' | 'G' = 'E',
): HistoricAnswer => ({
  attemptId,
  questionId,
  isCorrect,
  topicId: topic,
  topicName: topic === 'E' ? 'Equações' : 'Geometria',
});

describe('latestAnswerPerQuestion (current state)', () => {
  it('keeps only the most recent answer of each question', () => {
    // a3 is the newest attempt. q1: wrong, wrong, right -> right now. q2: right, then wrong -> wrong now.
    const answers = [
      ans('a1', 'q1', false),
      ans('a2', 'q1', false),
      ans('a3', 'q1', true),
      ans('a1', 'q2', true),
      ans('a3', 'q2', false),
    ];
    const current = latestAnswerPerQuestion(answers, ['a3', 'a2', 'a1']);
    expect(current).toHaveLength(2);
    expect(current.find((a) => a.questionId === 'q1')?.isCorrect).toBe(true);
    expect(current.find((a) => a.questionId === 'q2')?.isCorrect).toBe(false);
  });

  it('does not depend on the order answers are listed in', () => {
    const answers = [ans('a3', 'q1', true), ans('a1', 'q1', false), ans('a2', 'q1', false)];
    for (const input of [answers, [...answers].reverse()]) {
      expect(latestAnswerPerQuestion(input, ['a3', 'a2', 'a1'])[0]?.isCorrect).toBe(true);
    }
  });

  it('ignores answers from attempts outside the window', () => {
    expect(latestAnswerPerQuestion([ans('old', 'q1', true)], ['a1'])).toEqual([]);
  });

  it('after fixing the mistakes a topic stops needing review (the user scenario)', () => {
    // 10 wrong attempts on the same 4 questions, then 1 right attempt: aggregate would be ~9%.
    const qs = ['q1', 'q2', 'q3', 'q4'];
    const ids = ['new', ...Array.from({ length: 10 }, (_, i) => `old${i}`)];
    const answers = [
      ...qs.map((q) => ans('new', q, true)),
      ...ids.slice(1).flatMap((id) => qs.map((q) => ans(id, q, false))),
    ];
    expect(selectReviewTopics(latestAnswerPerQuestion(answers, ids))).toEqual([]);
    expect(selectReviewTopics(answers)).toHaveLength(1); // the old aggregate would still flag it
  });
});

describe('buildProgress', () => {
  const attempt = (id: string, hour: number, scorePct: number): AttemptSummary => ({
    id,
    submittedAt: new Date(Date.UTC(2026, 0, 1, hour)),
    scorePct,
  });

  it('returns attempts oldest first with per-topic accuracy', () => {
    const attempts = [attempt('a2', 2, 75), attempt('a1', 1, 25)]; // newest first
    const answers = [
      ...[true, false, false, false].map((c, i) => ans('a1', `e${i}`, c, 'E')),
      ...[true, true, true, true].map((c, i) => ans('a1', `g${i}`, c, 'G')),
      ...[true, true, true, false].map((c, i) => ans('a2', `e${i}`, c, 'E')),
      ...[true, true, false, false].map((c, i) => ans('a2', `g${i}`, c, 'G')),
    ];
    const progress = buildProgress(answers, attempts);
    expect(progress.map((p) => p.attemptId)).toEqual(['a1', 'a2']);
    expect(progress[0]?.topics).toEqual([
      { topicId: 'E', topicName: 'Equações', correctCount: 1, totalCount: 4, accuracyPct: 25 },
      { topicId: 'G', topicName: 'Geometria', correctCount: 4, totalCount: 4, accuracyPct: 100 },
    ]);
    expect(progress[1]?.topics.map((t) => t.accuracyPct)).toEqual([75, 50]);
    expect(progress.map((p) => p.scorePct)).toEqual([25, 75]);
  });

  it('is empty without attempts', () => {
    expect(buildProgress([], [])).toEqual([]);
  });
});
