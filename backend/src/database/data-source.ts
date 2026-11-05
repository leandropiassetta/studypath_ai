import 'reflect-metadata';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DataSource } from 'typeorm';
import {
  Attempt,
  AttemptAnswer,
  Question,
  Quiz,
  QuizQuestion,
  Student,
  Topic,
} from './entities/index.js';

const here = dirname(fileURLToPath(import.meta.url));

export function createDataSource(url: string): DataSource {
  return new DataSource({
    type: 'postgres',
    url,
    uuidExtension: 'pgcrypto',
    entities: [Student, Topic, Quiz, Question, QuizQuestion, Attempt, AttemptAnswer],
    // Schema changes happen only through versioned migrations.
    synchronize: false,
    migrationsRun: false,
    // Resolves to .ts under tsx/vitest and .js after build.
    migrations: [join(here, 'migrations', '*.{ts,js}')],
  });
}
