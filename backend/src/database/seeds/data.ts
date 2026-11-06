import type { Difficulty, QuestionOption } from '../entities/index.js';

// Stable IDs so the README, Flutter app and tests can refer to them.
export const DEMO_STUDENT_ID = '55555555-5555-4555-8555-555555555555';
/** Stable id of the optional seeded teacher account. */
export const TEACHER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const DEMO_QUIZ_ID = '11111111-1111-4111-8111-111111111111';
export const DEMO_QUIZ_SLUG = 'demo-matematica';
export const TOPIC_EQUACOES_ID = '33333333-3333-4333-8333-333333333333';
export const TOPIC_GEOMETRIA_ID = '33333333-3333-4333-8333-333333333334';

export interface SeedQuestion {
  id: string;
  topicId: string;
  statement: string;
  options: QuestionOption[];
  correctOption: string;
  difficulty: Difficulty;
  referenceExplanation: string;
  createdAt: Date;
  /** Position in the demo quiz, or null for extra (recommendation-only) questions. */
  quizPosition: number | null;
}

interface Draft {
  topicId: string;
  difficulty: Difficulty;
  statement: string;
  choices: string[];
  correct: number; // index into choices
  explanation: string;
  quizPosition: number | null;
}

const KEYS = ['A', 'B', 'C', 'D'];

// Original, fictional content. Order defines id suffix and createdAt (deterministic).
const DRAFTS: Draft[] = [
  // --- Demo quiz: Equações (positions 1-4) ---
  {
    topicId: TOPIC_EQUACOES_ID,
    difficulty: 'easy',
    quizPosition: 1,
    statement: 'Quanto é x se x + 2 = 5?',
    choices: ['2', '3', '5'],
    correct: 1,
    explanation: 'Subtraia 2 dos dois lados: x = 5 - 2 = 3.',
  },
  {
    topicId: TOPIC_EQUACOES_ID,
    difficulty: 'easy',
    quizPosition: 2,
    statement: 'Qual é o valor de x em 2x = 10?',
    choices: ['4', '5', '6', '8'],
    correct: 1,
    explanation: 'Divida os dois lados por 2: x = 10 / 2 = 5.',
  },
  {
    topicId: TOPIC_EQUACOES_ID,
    difficulty: 'medium',
    quizPosition: 3,
    statement: 'Resolva 3x - 4 = 11.',
    choices: ['3', '4', '5', '6'],
    correct: 2,
    explanation: 'Some 4: 3x = 15. Divida por 3: x = 5.',
  },
  {
    topicId: TOPIC_EQUACOES_ID,
    difficulty: 'hard',
    quizPosition: 4,
    statement: 'Resolva 2(x + 3) = 5x - 3.',
    choices: ['1', '2', '3', '4'],
    correct: 2,
    explanation: 'Distribua: 2x + 6 = 5x - 3. Então 9 = 3x e x = 3.',
  },
  // --- Demo quiz: Geometria (positions 5-8) ---
  {
    topicId: TOPIC_GEOMETRIA_ID,
    difficulty: 'easy',
    quizPosition: 5,
    statement: 'Quanto soma os ângulos internos de um triângulo?',
    choices: ['90°', '180°', '270°', '360°'],
    correct: 1,
    explanation: 'Em qualquer triângulo plano, os ângulos internos somam 180°.',
  },
  {
    topicId: TOPIC_GEOMETRIA_ID,
    difficulty: 'easy',
    quizPosition: 6,
    statement: 'Qual é a área de um retângulo de 6 cm por 4 cm?',
    choices: ['10 cm²', '20 cm²', '24 cm²', '48 cm²'],
    correct: 2,
    explanation: 'Área = base × altura = 6 × 4 = 24 cm².',
  },
  {
    topicId: TOPIC_GEOMETRIA_ID,
    difficulty: 'medium',
    quizPosition: 7,
    statement: 'Um quadrado tem área 49 cm². Qual é o seu perímetro?',
    choices: ['14 cm', '28 cm', '49 cm', '196 cm'],
    correct: 1,
    explanation: 'Lado = 7 cm (7² = 49). Perímetro = 4 × 7 = 28 cm.',
  },
  {
    topicId: TOPIC_GEOMETRIA_ID,
    difficulty: 'hard',
    quizPosition: 8,
    statement: 'Um triângulo retângulo tem catetos 6 e 8. Qual é a hipotenusa?',
    choices: ['9', '10', '12', '14'],
    correct: 1,
    explanation: 'Pitágoras: 6² + 8² = 100, logo a hipotenusa é 10.',
  },
  // --- Extras (not in the quiz): Equações ---
  {
    topicId: TOPIC_EQUACOES_ID,
    difficulty: 'easy',
    quizPosition: null,
    statement: 'Quanto é x se x - 7 = 1?',
    choices: ['6', '7', '8', '9'],
    correct: 2,
    explanation: 'Some 7 aos dois lados: x = 1 + 7 = 8.',
  },
  {
    topicId: TOPIC_EQUACOES_ID,
    difficulty: 'medium',
    quizPosition: null,
    statement: 'Resolva 5x + 2 = 3x + 10.',
    choices: ['2', '4', '6', '8'],
    correct: 1,
    explanation: 'Passe 3x e 2 para o outro lado: 2x = 8, então x = 4.',
  },
  {
    topicId: TOPIC_EQUACOES_ID,
    difficulty: 'hard',
    quizPosition: null,
    statement: 'Resolva (x - 1) / 2 = (x + 1) / 3.',
    choices: ['3', '4', '5', '6'],
    correct: 2,
    explanation: 'Multiplique em cruz: 3x - 3 = 2x + 2, então x = 5.',
  },
  // --- Extras (not in the quiz): Geometria ---
  {
    topicId: TOPIC_GEOMETRIA_ID,
    difficulty: 'easy',
    quizPosition: null,
    statement: 'Quantos lados tem um hexágono?',
    choices: ['5', '6', '7', '8'],
    correct: 1,
    explanation: 'O prefixo "hexa" indica seis: um hexágono tem 6 lados.',
  },
  {
    topicId: TOPIC_GEOMETRIA_ID,
    difficulty: 'medium',
    quizPosition: null,
    statement: 'Qual é a área de um triângulo de base 10 cm e altura 6 cm?',
    choices: ['16 cm²', '30 cm²', '60 cm²', '120 cm²'],
    correct: 1,
    explanation: 'Área = base × altura / 2 = 10 × 6 / 2 = 30 cm².',
  },
  {
    topicId: TOPIC_GEOMETRIA_ID,
    difficulty: 'hard',
    quizPosition: null,
    statement: 'Qual é a área de um círculo de raio 3 cm?',
    choices: ['3π cm²', '6π cm²', '9π cm²', '12π cm²'],
    correct: 2,
    explanation: 'Área = π × r² = π × 3² = 9π cm².',
  },
  // --- Extras added for review quizzes: Equações ---
  {
    topicId: TOPIC_EQUACOES_ID,
    difficulty: 'easy',
    quizPosition: null,
    statement: 'Quanto é x se 3x = 12?',
    choices: ['3', '4', '6', '9'],
    correct: 1,
    explanation: 'Divida os dois lados por 3: x = 12 / 3 = 4.',
  },
  {
    topicId: TOPIC_EQUACOES_ID,
    difficulty: 'easy',
    quizPosition: null,
    statement: 'Qual é o valor de x em x / 2 = 6?',
    choices: ['3', '8', '12', '16'],
    correct: 2,
    explanation: 'Multiplique os dois lados por 2: x = 6 × 2 = 12.',
  },
  {
    topicId: TOPIC_EQUACOES_ID,
    difficulty: 'medium',
    quizPosition: null,
    statement: 'Resolva 4x + 3 = 19.',
    choices: ['3', '4', '5', '6'],
    correct: 1,
    explanation: 'Subtraia 3: 4x = 16. Divida por 4: x = 4.',
  },
  {
    topicId: TOPIC_EQUACOES_ID,
    difficulty: 'medium',
    quizPosition: null,
    statement: 'Resolva 7x - 5 = 2x + 15.',
    choices: ['2', '3', '4', '5'],
    correct: 2,
    explanation: 'Passe 2x e 5 para o outro lado: 5x = 20, então x = 4.',
  },
  {
    topicId: TOPIC_EQUACOES_ID,
    difficulty: 'hard',
    quizPosition: null,
    statement: 'Resolva 3(x - 2) = 2x + 1.',
    choices: ['5', '6', '7', '8'],
    correct: 2,
    explanation: 'Distribua: 3x - 6 = 2x + 1. Então x = 7.',
  },
  // --- Extras added for review quizzes: Geometria ---
  {
    topicId: TOPIC_GEOMETRIA_ID,
    difficulty: 'easy',
    quizPosition: null,
    statement: 'Quantos lados tem um pentágono?',
    choices: ['4', '5', '6', '8'],
    correct: 1,
    explanation: 'O prefixo "penta" indica cinco: um pentágono tem 5 lados.',
  },
  {
    topicId: TOPIC_GEOMETRIA_ID,
    difficulty: 'easy',
    quizPosition: null,
    statement: 'Qual é o perímetro de um quadrado de lado 5 cm?',
    choices: ['10 cm', '15 cm', '20 cm', '25 cm'],
    correct: 2,
    explanation: 'Perímetro = 4 × lado = 4 × 5 = 20 cm.',
  },
  {
    topicId: TOPIC_GEOMETRIA_ID,
    difficulty: 'medium',
    quizPosition: null,
    statement: 'Qual é a área de um quadrado de lado 9 cm?',
    choices: ['18 cm²', '36 cm²', '81 cm²', '90 cm²'],
    correct: 2,
    explanation: 'Área = lado × lado = 9 × 9 = 81 cm².',
  },
  {
    topicId: TOPIC_GEOMETRIA_ID,
    difficulty: 'medium',
    quizPosition: null,
    statement: 'Um retângulo tem perímetro 24 cm e largura 4 cm. Qual é o comprimento?',
    choices: ['6 cm', '8 cm', '10 cm', '12 cm'],
    correct: 1,
    explanation: '2 × (comprimento + 4) = 24, então comprimento + 4 = 12 e o comprimento é 8 cm.',
  },
  {
    topicId: TOPIC_GEOMETRIA_ID,
    difficulty: 'hard',
    quizPosition: null,
    statement: 'Qual é o comprimento de uma circunferência de raio 5 cm?',
    choices: ['5π cm', '10π cm', '15π cm', '25π cm'],
    correct: 1,
    explanation: 'Comprimento = 2 × π × raio = 2 × π × 5 = 10π cm.',
  },
];

const BASE_TIME = Date.UTC(2026, 0, 1, 0, 0, 0);

export function buildSeedQuestions(): SeedQuestion[] {
  return DRAFTS.map((d, i) => ({
    id: `22222222-2222-4222-8222-${String(i + 1).padStart(12, '0')}`,
    topicId: d.topicId,
    statement: d.statement,
    options: d.choices.map((text, idx) => ({ key: KEYS[idx] as string, text })),
    correctOption: KEYS[d.correct] as string,
    difficulty: d.difficulty,
    referenceExplanation: d.explanation,
    createdAt: new Date(BASE_TIME + i * 60_000),
    quizPosition: d.quizPosition,
  }));
}

/** Returns a list of problems; empty means the question is coherent. */
export function validateSeedQuestion(q: SeedQuestion): string[] {
  const problems: string[] = [];
  const keys = q.options.map((o) => o.key);
  if (new Set(keys).size !== keys.length) problems.push(`${q.id}: duplicate option keys`);
  if (q.options.length < 2) problems.push(`${q.id}: fewer than 2 options`);
  if (!keys.includes(q.correctOption)) problems.push(`${q.id}: correct option not in options`);
  return problems;
}
