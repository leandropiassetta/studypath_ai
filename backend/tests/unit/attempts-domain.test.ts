import { describe, expect, it } from 'vitest';
import {
  canonicalPayloadHash,
  gradeAttempt,
  percentage,
  validateAnswers,
  type QuestionKey,
  type SubmittedAnswer,
} from '../../src/modules/attempts/domain.js';

const q = (n: number, topic: 'E' | 'G', correct = 'B'): QuestionKey => ({
  id: `q${n}`,
  topicId: topic,
  topicName: topic === 'E' ? 'Equações' : 'Geometria',
  optionKeys: ['A', 'B', 'C'],
  correctOption: correct,
  referenceExplanation: `exp${n}`,
});
const quiz = [q(1, 'E'), q(2, 'E'), q(3, 'G'), q(4, 'G')];
const answersWith = (picks: string[]): SubmittedAnswer[] =>
  picks.map((selectedOption, i) => ({ questionId: `q${i + 1}`, selectedOption }));

describe('percentage', () => {
  it.each([
    [0, 8, 0],
    [4, 8, 50],
    [8, 8, 100],
    [1, 3, 33.33],
    [2, 3, 66.67],
    [1, 8, 12.5],
    [1, 6, 16.67],
  ])('%i/%i -> %f', (c, t, expected) => {
    expect(percentage(c, t)).toBe(expected);
  });
});

describe('gradeAttempt', () => {
  it.each([
    ['0%', ['A', 'A', 'A', 'A'], 0, 0],
    ['50%', ['B', 'A', 'B', 'A'], 2, 50],
    ['100%', ['B', 'B', 'B', 'B'], 4, 100],
  ])('grades %s', (_n, picks, correct, pct) => {
    const g = gradeAttempt(quiz, answersWith(picks));
    expect(g.correctCount).toBe(correct);
    expect(g.totalCount).toBe(4);
    expect(g.scorePct).toBe(pct);
  });

  it('computes per-topic results and per-answer correctness in quiz order', () => {
    const g = gradeAttempt(quiz, answersWith(['B', 'A', 'B', 'B']));
    expect(g.topicResults).toEqual([
      { topicId: 'E', topicName: 'Equações', correctCount: 1, totalCount: 2, accuracyPct: 50 },
      { topicId: 'G', topicName: 'Geometria', correctCount: 2, totalCount: 2, accuracyPct: 100 },
    ]);
    expect(g.answers.map((a) => a.isCorrect)).toEqual([true, false, true, true]);
    expect(g.answers[1]).toMatchObject({ selectedOption: 'A', correctOption: 'B' });
  });

  it('returns answers in quiz order even if submitted shuffled', () => {
    const shuffled = [...answersWith(['B', 'B', 'B', 'B'])].reverse();
    expect(gradeAttempt(quiz, shuffled).answers.map((a) => a.questionId)).toEqual([
      'q1',
      'q2',
      'q3',
      'q4',
    ]);
  });
});

describe('validateAnswers', () => {
  it('accepts exactly one valid answer per question, in any order', () => {
    expect(validateAnswers(quiz, answersWith(['A', 'B', 'C', 'A']).reverse())).toEqual([]);
  });

  it('reports missing, duplicate, unknown and invalid-option answers', () => {
    const issues = validateAnswers(quiz, [
      { questionId: 'q1', selectedOption: 'A' },
      { questionId: 'q1', selectedOption: 'B' },
      { questionId: 'q2', selectedOption: 'Z' },
      { questionId: 'outside', selectedOption: 'A' },
    ]);
    expect(issues).toEqual(
      expect.arrayContaining([
        { code: 'DUPLICATE_ANSWER', questionId: 'q1' },
        { code: 'INVALID_OPTION', questionId: 'q2' },
        { code: 'UNKNOWN_QUESTION', questionId: 'outside' },
        { code: 'MISSING_ANSWER', questionId: 'q3' },
        { code: 'MISSING_ANSWER', questionId: 'q4' },
      ]),
    );
    expect(issues).toHaveLength(5);
  });

  it('rejects an empty submission', () => {
    expect(validateAnswers(quiz, [])).toHaveLength(4);
  });
});

describe('canonicalPayloadHash', () => {
  const a = answersWith(['A', 'B', 'C', 'A']);

  it('is independent of answer order', () => {
    expect(canonicalPayloadHash('quiz', a)).toBe(canonicalPayloadHash('quiz', [...a].reverse()));
  });

  it('changes with answers or quiz', () => {
    const base = canonicalPayloadHash('quiz', a);
    expect(canonicalPayloadHash('quiz', answersWith(['A', 'B', 'C', 'B']))).not.toBe(base);
    expect(canonicalPayloadHash('other', a)).not.toBe(base);
  });

  it('is a 64-char hex SHA-256', () => {
    expect(canonicalPayloadHash('quiz', a)).toMatch(/^[0-9a-f]{64}$/);
  });
});
