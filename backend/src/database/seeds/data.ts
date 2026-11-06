import type { Difficulty, QuestionOption } from '../entities/index.js';

// Stable IDs so the README, Flutter app and tests can refer to them.
export const DEMO_STUDENT_ID = '55555555-5555-4555-8555-555555555555';
/** Stable id of the optional seeded teacher account. */
export const TEACHER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const DEMO_QUIZ_ID = '11111111-1111-4111-8111-111111111111';
export const DEMO_QUIZ_SLUG = 'demo-matematica';
export const TOPIC_EQUACOES_ID = '33333333-3333-4333-8333-333333333333';
export const TOPIC_GEOMETRIA_ID = '33333333-3333-4333-8333-333333333334';
export const TOPIC_GEOGRAFIA_ID = '33333333-3333-4333-8333-333333333335';
export const TOPIC_HISTORIA_ID = '33333333-3333-4333-8333-333333333336';
export const TOPIC_INGLES_ID = '33333333-3333-4333-8333-333333333337';
export const TOPIC_CIENCIAS_ID = '33333333-3333-4333-8333-333333333338';

export const SEED_TOPICS = [
  { id: TOPIC_EQUACOES_ID, name: 'Equações' },
  { id: TOPIC_GEOMETRIA_ID, name: 'Geometria' },
  { id: TOPIC_GEOGRAFIA_ID, name: 'Geografia' },
  { id: TOPIC_HISTORIA_ID, name: 'História' },
  { id: TOPIC_INGLES_ID, name: 'Inglês' },
  { id: TOPIC_CIENCIAS_ID, name: 'Ciências' },
];

/** One simulado per subject. Math is the original demo quiz and keeps its stable id and slug. */
export const SEED_QUIZZES = [
  { id: DEMO_QUIZ_ID, slug: DEMO_QUIZ_SLUG, title: 'Simulado de Matemática' },
  {
    id: '11111111-1111-4111-8111-111111111112',
    slug: 'demo-geografia',
    title: 'Simulado de Geografia',
  },
  {
    id: '11111111-1111-4111-8111-111111111113',
    slug: 'demo-historia',
    title: 'Simulado de História',
  },
  { id: '11111111-1111-4111-8111-111111111114', slug: 'demo-ingles', title: 'Simulado de Inglês' },
  {
    id: '11111111-1111-4111-8111-111111111115',
    slug: 'demo-ciencias',
    title: 'Simulado de Ciências',
  },
];

export interface SeedQuestion {
  id: string;
  topicId: string;
  statement: string;
  options: QuestionOption[];
  correctOption: string;
  difficulty: Difficulty;
  referenceExplanation: string;
  createdAt: Date;
  /** Position in the quiz, or null for extra (recommendation-only) questions. */
  quizPosition: number | null;
  /** Slug of the quiz the question belongs to (null for extras). */
  quizSlug: string | null;
}

interface Draft {
  topicId: string;
  difficulty: Difficulty;
  statement: string;
  choices: string[];
  correct: number; // index into choices
  explanation: string;
  quizPosition: number | null;
  /** Defaults to the math demo quiz. */
  quizSlug?: string;
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

type Pick = [statement: string, choices: string[], correct: number, explanation: string];

/**
 * A subject: 4 quiz questions (easy, easy, medium, medium) and 4 extras for recommendations and
 * review quizzes (easy, easy, medium, hard). Every explanation follows "pista: fato": what comes
 * before the first colon is a cue that does not reveal the answer (the fallback for hint level 2).
 */
function subject(topicId: string, slug: string, picks: Pick[]): Draft[] {
  const difficulties: Difficulty[] = [
    'easy',
    'easy',
    'medium',
    'medium',
    'easy',
    'easy',
    'medium',
    'hard',
  ];
  return picks.map(([statement, choices, correct, explanation], i) => ({
    topicId,
    difficulty: difficulties[i] as Difficulty,
    quizPosition: i < 4 ? i + 1 : null,
    ...(i < 4 ? { quizSlug: slug } : {}),
    statement,
    choices,
    correct,
    explanation,
  }));
}

DRAFTS.push(
  ...subject(TOPIC_GEOGRAFIA_ID, 'demo-geografia', [
    [
      'Qual é a capital do Brasil?',
      ['Rio de Janeiro', 'Brasília', 'São Paulo', 'Salvador'],
      1,
      'Pense em qual cidade abriga a sede do governo federal: a capital do Brasil é Brasília, inaugurada em 1960.',
    ],
    [
      'Qual é o maior oceano do planeta?',
      ['Atlântico', 'Índico', 'Pacífico', 'Ártico'],
      2,
      'Compare a área ocupada por cada oceano: o maior é o Pacífico, que cobre cerca de um terço da superfície da Terra.',
    ],
    [
      'Qual é o maior rio do Brasil em extensão?',
      ['São Francisco', 'Amazonas', 'Paraná', 'Tocantins'],
      1,
      'Lembre-se da maior bacia hidrográfica do mundo: o rio Amazonas é o mais extenso e caudaloso do Brasil.',
    ],
    [
      'Em qual continente fica o deserto do Saara?',
      ['Ásia', 'África', 'Oceania', 'América do Sul'],
      1,
      'Pense no maior deserto quente do planeta e em onde ele fica: o Saara está no norte da África.',
    ],
    [
      'Qual região brasileira tem o maior número de estados?',
      ['Sul', 'Sudeste', 'Nordeste', 'Norte'],
      2,
      'Conte os estados de cada região do país: o Nordeste tem 9 estados, o maior número entre as regiões.',
    ],
    [
      'Qual é a capital da Argentina?',
      ['Montevidéu', 'Buenos Aires', 'Santiago', 'Lima'],
      1,
      'Lembre-se da cidade às margens do Rio da Prata: a capital da Argentina é Buenos Aires.',
    ],
    [
      'Qual linha imaginária divide a Terra nos hemisférios Norte e Sul?',
      ['Trópico de Câncer', 'Meridiano de Greenwich', 'Equador', 'Trópico de Capricórnio'],
      2,
      'Pense na linha de latitude zero: a linha do Equador separa os hemisférios Norte e Sul.',
    ],
    [
      'Qual é o menor país do mundo em área?',
      ['Mônaco', 'Vaticano', 'San Marino', 'Liechtenstein'],
      1,
      'Pense em um Estado inteiramente cercado pela cidade de Roma: o menor país do mundo é o Vaticano, com cerca de 0,44 km².',
    ],
  ]),
  ...subject(TOPIC_HISTORIA_ID, 'demo-historia', [
    [
      'Em que ano o Brasil declarou a independência de Portugal?',
      ['1500', '1822', '1889', '1922'],
      1,
      'Lembre-se do grito do Ipiranga, dado por Dom Pedro I: a Independência do Brasil foi proclamada em 1822.',
    ],
    [
      'Quem foi o primeiro presidente do Brasil?',
      ['Getúlio Vargas', 'Deodoro da Fonseca', 'Dom Pedro II', 'Juscelino Kubitschek'],
      1,
      'Pense em quem comandou a Proclamação da República, em 1889: o primeiro presidente foi o marechal Deodoro da Fonseca.',
    ],
    [
      'A Revolução Francesa começou em que ano?',
      ['1689', '1789', '1889', '1815'],
      1,
      'Relacione a queda da Bastilha ao início da Revolução Francesa: o marco inicial foi 14 de julho de 1789.',
    ],
    [
      'Qual civilização construiu as pirâmides de Gizé?',
      ['Romana', 'Egípcia', 'Maia', 'Grega'],
      1,
      'Pense no povo que vivia às margens do rio Nilo e era governado por faraós: as pirâmides de Gizé foram construídas pelos egípcios.',
    ],
    [
      'Quem comandou a frota portuguesa que chegou ao Brasil em 1500?',
      ['Cristóvão Colombo', 'Pedro Álvares Cabral', 'Vasco da Gama', 'Dom João VI'],
      1,
      'Lembre-se da frota que chegou ao litoral da Bahia: o comandante foi Pedro Álvares Cabral.',
    ],
    [
      'Em que ano terminou a Segunda Guerra Mundial?',
      ['1918', '1939', '1945', '1950'],
      2,
      'Lembre-se da rendição do Japão, depois das bombas atômicas: a guerra terminou em 1945.',
    ],
    [
      'Qual lei aboliu a escravidão no Brasil?',
      ['Lei do Ventre Livre', 'Lei Áurea', 'Lei Eusébio de Queirós', 'Lei dos Sexagenários'],
      1,
      'Pense na lei assinada pela princesa Isabel em 1888: foi a Lei Áurea que aboliu a escravidão.',
    ],
    [
      'A queda do Muro de Berlim aconteceu em que ano?',
      ['1961', '1979', '1989', '1991'],
      2,
      'Relacione o muro ao fim da Guerra Fria na Europa: ele caiu em 1989.',
    ],
  ]),
  ...subject(TOPIC_INGLES_ID, 'demo-ingles', [
    [
      "Qual é a tradução de 'house' para o português?",
      ['Casa', 'Carro', 'Cachorro', 'Cadeira'],
      0,
      "Pense no lugar onde as pessoas moram: 'house' significa casa.",
    ],
    [
      "Complete a frase: 'She ___ a student.'",
      ['am', 'is', 'are', 'be'],
      1,
      "Lembre-se do verbo to be na terceira pessoa do singular: com 'she' usamos 'is'.",
    ],
    [
      "Qual é o plural de 'child'?",
      ['childs', 'childrens', 'children', 'childes'],
      2,
      "Lembre-se de que alguns substantivos têm plural irregular: o plural de 'child' é 'children'.",
    ],
    [
      "Complete a frase: 'I ___ to school every day.'",
      ['go', 'goes', 'going', 'gone'],
      0,
      "Observe o sujeito e o presente simples: com 'I' o verbo fica sem -s, ou seja, 'go'.",
    ],
    [
      "Como se diz 'obrigado' em inglês?",
      ['Please', 'Sorry', 'Thank you', 'Welcome'],
      2,
      "Pense na expressão de agradecimento mais comum: 'obrigado' é 'thank you'.",
    ],
    [
      "Qual é o oposto de 'hot'?",
      ['Warm', 'Cold', 'Big', 'Small'],
      1,
      "Pense na temperatura contrária: o oposto de 'hot' (quente) é 'cold' (frio).",
    ],
    [
      "Qual é o passado simples do verbo 'go'?",
      ['goed', 'went', 'gone', 'going'],
      1,
      "Lembre-se de que é um verbo irregular, que muda de forma no passado: o passado de 'go' é 'went'.",
    ],
    [
      'Qual frase está correta?',
      [
        "He don't like pizza.",
        "He doesn't likes pizza.",
        "He doesn't like pizza.",
        'He not like pizza.',
      ],
      2,
      "Lembre-se da regra da negativa na terceira pessoa do singular: usa-se 'doesn't' e o verbo principal fica sem -s.",
    ],
  ]),
  ...subject(TOPIC_CIENCIAS_ID, 'demo-ciencias', [
    [
      'Qual gás as plantas absorvem na fotossíntese?',
      ['Oxigênio', 'Gás carbônico', 'Nitrogênio', 'Hidrogênio'],
      1,
      'Pense no gás que as plantas retiram do ar para produzir alimento: elas absorvem gás carbônico e liberam oxigênio.',
    ],
    [
      'Qual é o planeta mais próximo do Sol?',
      ['Vênus', 'Terra', 'Mercúrio', 'Marte'],
      2,
      'Ordene os planetas a partir do Sol: o primeiro da lista é Mercúrio.',
    ],
    [
      'Qual é a fórmula química da água?',
      ['CO₂', 'H₂O', 'O₂', 'NaCl'],
      1,
      'Lembre-se dos elementos que formam a água: dois átomos de hidrogênio e um de oxigênio, ou seja, H₂O.',
    ],
    [
      'Qual órgão bombeia o sangue pelo corpo humano?',
      ['Pulmão', 'Fígado', 'Coração', 'Rim'],
      2,
      'Pense no órgão do sistema circulatório que pulsa o tempo todo: o coração bombeia o sangue para o corpo inteiro.',
    ],
    [
      'Em que estado físico a água está a 25 °C, ao nível do mar?',
      ['Sólido', 'Líquido', 'Gasoso', 'Plasma'],
      1,
      'Compare 25 °C com os pontos de congelamento (0 °C) e de ebulição (100 °C): a água está no estado líquido.',
    ],
    [
      'Qual é a principal fonte de energia da Terra?',
      ['Lua', 'Sol', 'Vento', 'Carvão'],
      1,
      'Pense na estrela que aquece e ilumina o planeta: o Sol é a principal fonte de energia da Terra.',
    ],
    [
      'Quantos ossos tem o corpo de um adulto?',
      ['106', '206', '306', '406'],
      1,
      'Lembre-se do número ensinado nas aulas de anatomia: um adulto tem 206 ossos.',
    ],
    [
      'O que acontece com a velocidade de um objeto em queda livre, sem resistência do ar?',
      ['Diminui', 'Aumenta', 'Permanece constante', 'Zera'],
      1,
      'Pense na gravidade agindo o tempo todo sobre o objeto: a velocidade aumenta cerca de 9,8 m/s a cada segundo.',
    ],
  ]),
);

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
    quizSlug: d.quizPosition === null ? null : (d.quizSlug ?? DEMO_QUIZ_SLUG),
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
