import { describe, expect, it } from 'vitest';
import {
  TOPIC_EQUACOES_ID,
  TOPIC_GEOMETRIA_ID,
  SEED_QUIZZES,
  SEED_TOPICS,
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

  it('has one simulado per subject, each with ordered positions, and extras for review', () => {
    const slugs = SEED_QUIZZES.map((q) => q.slug);
    expect(slugs).toEqual([
      'demo-matematica',
      'demo-geografia',
      'demo-historia',
      'demo-ingles',
      'demo-ciencias',
    ]);
    expect(new Set(SEED_QUIZZES.map((q) => q.id)).size).toBe(slugs.length);

    const math = questions.filter((q) => q.quizSlug === 'demo-matematica');
    expect(math.map((q) => q.quizPosition).sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (const topic of [TOPIC_EQUACOES_ID, TOPIC_GEOMETRIA_ID]) {
      expect(math.filter((q) => q.topicId === topic)).toHaveLength(4);
      expect(questions.filter((q) => q.topicId === topic && q.quizPosition === null)).toHaveLength(
        8,
      );
    }
    for (const slug of slugs.slice(1)) {
      const own = questions.filter((q) => q.quizSlug === slug);
      // Like math: 8 questions, 4 per subtopic, the first subtopic in positions 1-4.
      expect(own.map((q) => q.quizPosition).sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      const topics = [...new Set(own.map((q) => q.topicId))];
      expect(topics).toHaveLength(2);
      for (const topicId of topics) {
        expect(own.filter((q) => q.topicId === topicId)).toHaveLength(4);
        // Enough unseen questions for "Praticar este assunto" after a quiz.
        expect(
          questions.filter((q) => q.topicId === topicId && q.quizPosition === null),
        ).toHaveLength(4);
      }
      const first = own.filter((q) => q.quizPosition! <= 4).map((q) => q.topicId);
      expect(new Set(first).size).toBe(1);
    }
    expect(SEED_TOPICS.map((t) => t.name)).toEqual([
      'Equações',
      'Geometria',
      'Geografia do Brasil',
      'Geografia Mundial',
      'História do Brasil',
      'História Geral',
      'Vocabulário',
      'Gramática',
      'Biologia',
      'Física e Química',
    ]);
    expect(questions).toHaveLength(88);
  });

  it('explanations of the non-math subjects follow "cue: fact" (the cue is the level 2 hint)', () => {
    const math = new Set([TOPIC_EQUACOES_ID, TOPIC_GEOMETRIA_ID]);
    for (const q of questions.filter((x) => !math.has(x.topicId))) {
      expect(q.referenceExplanation.indexOf(':'), q.statement).toBeGreaterThan(10);
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
