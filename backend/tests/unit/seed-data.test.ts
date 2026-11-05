import { describe, expect, it } from 'vitest';
import {
  TOPIC_EQUACOES_ID,
  TOPIC_GEOMETRIA_ID,
  buildSeedQuestions,
  validateSeedQuestion,
  type SeedQuestion,
} from '../../src/database/seeds/data.js';

describe('seed data', () => {
  const questions = buildSeedQuestions();

  it('is coherent: unique ids, valid options, correct option present', () => {
    expect(new Set(questions.map((q) => q.id)).size).toBe(questions.length);
    expect(questions.flatMap(validateSeedQuestion)).toEqual([]);
  });

  it('has 8 quiz questions (4 per topic, positions 1-8) and 8 extras per topic', () => {
    const inQuiz = questions.filter((q) => q.quizPosition !== null);
    expect(inQuiz.map((q) => q.quizPosition).sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (const topic of [TOPIC_EQUACOES_ID, TOPIC_GEOMETRIA_ID]) {
      expect(inQuiz.filter((q) => q.topicId === topic)).toHaveLength(4);
      expect(questions.filter((q) => q.topicId === topic && q.quizPosition === null)).toHaveLength(
        8,
      );
    }
  });

  it('is deterministic', () => {
    expect(buildSeedQuestions()).toEqual(questions);
  });

  it('validateSeedQuestion detects bad questions', () => {
    const base = questions[0] as SeedQuestion;
    expect(validateSeedQuestion({ ...base, correctOption: 'Z' })).toHaveLength(1);
    expect(
      validateSeedQuestion({
        ...base,
        options: [
          { key: 'A', text: 'x' },
          { key: 'A', text: 'y' },
        ],
        correctOption: 'A',
      }),
    ).toHaveLength(1);
  });
});
