import type { DataSource } from 'typeorm';
import { Question, Quiz, QuizQuestion, Student, Topic } from '../entities/index.js';
import {
  DEMO_QUIZ_ID,
  DEMO_QUIZ_SLUG,
  DEMO_STUDENT_ID,
  TOPIC_EQUACOES_ID,
  TOPIC_GEOMETRIA_ID,
  buildSeedQuestions,
  validateSeedQuestion,
} from './data.js';

export interface SeedOptions {
  /** Optional login for the demo student; omitted = the demo student cannot log in. */
  demoCredentials?: { email: string; passwordHash: string };
}

/** Idempotent: safe to run repeatedly; never touches attempts. All data is fictional. */
export async function seed(ds: DataSource, options: SeedOptions = {}): Promise<void> {
  const questions = buildSeedQuestions();
  const problems = questions.flatMap(validateSeedQuestion);
  if (problems.length > 0) throw new Error(`Invalid seed data: ${problems.join('; ')}`);

  const createdAt = new Date(Date.UTC(2026, 0, 1));
  await ds.transaction(async (m) => {
    await m.upsert(
      Student,
      {
        id: DEMO_STUDENT_ID,
        name: 'Aluno Demo',
        createdAt,
        ...(options.demoCredentials && {
          email: options.demoCredentials.email,
          passwordHash: options.demoCredentials.passwordHash,
        }),
      },
      ['id'],
    );
    await m.upsert(
      Topic,
      [
        { id: TOPIC_EQUACOES_ID, name: 'Equações', createdAt },
        { id: TOPIC_GEOMETRIA_ID, name: 'Geometria', createdAt },
      ],
      ['id'],
    );
    await m.upsert(
      Quiz,
      {
        id: DEMO_QUIZ_ID,
        slug: DEMO_QUIZ_SLUG,
        title: 'Simulado de Matemática',
        isActive: true,
        createdAt,
      },
      ['id'],
    );
    await m.upsert(
      Question,
      questions.map((q) => ({
        id: q.id,
        topicId: q.topicId,
        statement: q.statement,
        options: q.options,
        correctOption: q.correctOption,
        difficulty: q.difficulty,
        referenceExplanation: q.referenceExplanation,
        createdAt: q.createdAt,
      })),
      ['id'],
    );
    await m.upsert(
      QuizQuestion,
      questions.flatMap((q) =>
        q.quizPosition === null
          ? []
          : [{ quizId: DEMO_QUIZ_ID, questionId: q.id, position: q.quizPosition }],
      ),
      ['quizId', 'questionId'],
    );
  });
}
