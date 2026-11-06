import type { DataSource } from 'typeorm';
import { Question, Quiz, QuizQuestion, Student, Topic } from '../entities/index.js';
import {
  DEMO_STUDENT_ID,
  SEED_QUIZZES,
  SEED_TOPICS,
  TEACHER_ID,
  buildSeedQuestions,
  validateSeedQuestion,
} from './data.js';

export interface SeedOptions {
  /** Optional login for the demo student; omitted = the demo student cannot log in. */
  demoCredentials?: { email: string; passwordHash: string };
  /** Optional teacher account for the doubt queue; omitted = no teacher exists. */
  teacher?: { name: string; email: string; passwordHash: string };
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
    if (options.teacher) {
      await m.upsert(
        Student,
        {
          id: TEACHER_ID,
          name: options.teacher.name,
          email: options.teacher.email,
          passwordHash: options.teacher.passwordHash,
          role: 'teacher',
          createdAt,
        },
        ['id'],
      );
    }
    await m.upsert(
      Topic,
      SEED_TOPICS.map((t) => ({ ...t, createdAt })),
      ['id'],
    );
    await m.upsert(
      Quiz,
      SEED_QUIZZES.map((qz) => ({ ...qz, isActive: true, createdAt })),
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
    // Positions are unique per quiz, so re-ordering has to start from a clean slate. Only the
    // membership of the seeded quizzes is reset; attempts and answers are never touched.
    await m.query('DELETE FROM quiz_questions WHERE quiz_id = ANY($1::uuid[])', [
      SEED_QUIZZES.map((qz) => qz.id),
    ]);
    await m.upsert(
      QuizQuestion,
      questions.flatMap((q) => {
        const quiz = SEED_QUIZZES.find((qz) => qz.slug === q.quizSlug);
        return quiz && q.quizPosition !== null
          ? [{ quizId: quiz.id, questionId: q.id, position: q.quizPosition }]
          : [];
      }),
      ['quizId', 'questionId'],
    );
  });
}
