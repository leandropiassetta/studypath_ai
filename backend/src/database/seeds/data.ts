import type { Difficulty, QuestionOption } from '../entities/index.js';

// Stable IDs so the README, Flutter app and tests can refer to them.
export const DEMO_STUDENT_ID = '55555555-5555-4555-8555-555555555555';
/** Stable id of the optional seeded teacher account. */
export const TEACHER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const DEMO_QUIZ_ID = '11111111-1111-4111-8111-111111111111';
export const DEMO_QUIZ_SLUG = 'demo-matematica';
export const TOPIC_EQUACOES_ID = '33333333-3333-4333-8333-333333333333';
export const TOPIC_GEOMETRIA_ID = '33333333-3333-4333-8333-333333333334';
// Each subject has two subtopics (like math: Equações and Geometria).
export const TOPIC_GEO_BRASIL_ID = '33333333-3333-4333-8333-333333333335';
export const TOPIC_HIST_BRASIL_ID = '33333333-3333-4333-8333-333333333336';
export const TOPIC_ING_VOCAB_ID = '33333333-3333-4333-8333-333333333337';
export const TOPIC_CIE_BIO_ID = '33333333-3333-4333-8333-333333333338';
export const TOPIC_GEO_MUNDO_ID = '33333333-3333-4333-8333-333333333339';
export const TOPIC_HIST_GERAL_ID = '33333333-3333-4333-8333-33333333333a';
export const TOPIC_ING_GRAM_ID = '33333333-3333-4333-8333-33333333333b';
export const TOPIC_CIE_FISQUI_ID = '33333333-3333-4333-8333-33333333333c';
export const TOPIC_POR_ORTO_ID = '33333333-3333-4333-8333-33333333333d';
export const TOPIC_POR_CLASSES_ID = '33333333-3333-4333-8333-33333333333e';

export const SEED_TOPICS = [
  { id: TOPIC_EQUACOES_ID, name: 'Equações' },
  { id: TOPIC_GEOMETRIA_ID, name: 'Geometria' },
  { id: TOPIC_GEO_BRASIL_ID, name: 'Geografia do Brasil' },
  { id: TOPIC_GEO_MUNDO_ID, name: 'Geografia Mundial' },
  { id: TOPIC_HIST_BRASIL_ID, name: 'História do Brasil' },
  { id: TOPIC_HIST_GERAL_ID, name: 'História Geral' },
  { id: TOPIC_ING_VOCAB_ID, name: 'Vocabulário' },
  { id: TOPIC_ING_GRAM_ID, name: 'Gramática' },
  { id: TOPIC_CIE_BIO_ID, name: 'Biologia' },
  { id: TOPIC_CIE_FISQUI_ID, name: 'Física e Química' },
  { id: TOPIC_POR_ORTO_ID, name: 'Ortografia' },
  { id: TOPIC_POR_CLASSES_ID, name: 'Classes de Palavras' },
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
  {
    id: '11111111-1111-4111-8111-111111111116',
    slug: 'demo-portugues',
    title: 'Simulado de Português',
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

/** [statement, choices, correct index, explanation, subtopic (0|1), part of the simulado?] */
type Entry = [string, string[], number, string, 0 | 1, boolean];

const QUIZ_DIFFICULTY: Difficulty[] = ['easy', 'easy', 'medium', 'medium'];
const EXTRA_DIFFICULTY: Difficulty[] = ['easy', 'easy', 'medium', 'hard'];

/**
 * A subject with two subtopics, like math: each subtopic has 4 simulado questions (positions 1-4
 * for the first, 5-8 for the second) and 4 extras for recommendations and review quizzes.
 * Every explanation follows "pista: fato": what comes before the first colon is a cue that does
 * not reveal the answer (it is the fallback for hint level 2).
 */
function subject(slug: string, topics: [string, string], entries: Entry[]): Draft[] {
  const seen = new Map<string, number>();
  return entries.map(([statement, choices, correct, explanation, sub, inQuiz]) => {
    const group = `${sub}-${inQuiz}`;
    const i = seen.get(group) ?? 0;
    seen.set(group, i + 1);
    return {
      topicId: topics[sub],
      difficulty: (inQuiz ? QUIZ_DIFFICULTY : EXTRA_DIFFICULTY)[i] as Difficulty,
      quizPosition: inQuiz ? sub * 4 + i + 1 : null,
      ...(inQuiz ? { quizSlug: slug } : {}),
      statement,
      choices,
      correct,
      explanation,
    };
  });
}

// The first 8 entries of each subject are the ones seeded before the subtopics existed (their ids
// stay stable, so old attempts keep pointing at the same questions); the rest were added later.
const GEOGRAFIA = subject(
  'demo-geografia',
  [TOPIC_GEO_BRASIL_ID, TOPIC_GEO_MUNDO_ID],
  [
    [
      'Qual é a capital do Brasil?',
      ['Rio de Janeiro', 'Brasília', 'São Paulo', 'Salvador'],
      1,
      'Pense em qual cidade abriga a sede do governo federal: a capital do Brasil é Brasília, inaugurada em 1960.',
      0,
      true,
    ],
    [
      'Qual é o maior oceano do planeta?',
      ['Atlântico', 'Índico', 'Pacífico', 'Ártico'],
      2,
      'Compare a área ocupada por cada oceano: o maior é o Pacífico, que cobre cerca de um terço da superfície da Terra.',
      1,
      true,
    ],
    [
      'Qual é o maior rio do Brasil em extensão?',
      ['São Francisco', 'Amazonas', 'Paraná', 'Tocantins'],
      1,
      'Lembre-se da maior bacia hidrográfica do mundo: o rio Amazonas é o mais extenso e caudaloso do Brasil.',
      0,
      true,
    ],
    [
      'Em qual continente fica o deserto do Saara?',
      ['Ásia', 'África', 'Oceania', 'América do Sul'],
      1,
      'Pense no maior deserto quente do planeta e em onde ele fica: o Saara está no norte da África.',
      1,
      true,
    ],
    [
      'Qual região brasileira tem o maior número de estados?',
      ['Sul', 'Sudeste', 'Nordeste', 'Norte'],
      2,
      'Conte os estados de cada região do país: o Nordeste tem 9 estados, o maior número entre as regiões.',
      0,
      false,
    ],
    [
      'Qual é a capital da Argentina?',
      ['Montevidéu', 'Buenos Aires', 'Santiago', 'Lima'],
      1,
      'Lembre-se da cidade às margens do Rio da Prata: a capital da Argentina é Buenos Aires.',
      1,
      false,
    ],
    [
      'Qual linha imaginária divide a Terra nos hemisférios Norte e Sul?',
      ['Trópico de Câncer', 'Meridiano de Greenwich', 'Equador', 'Trópico de Capricórnio'],
      2,
      'Pense na linha de latitude zero: a linha do Equador separa os hemisférios Norte e Sul.',
      1,
      false,
    ],
    [
      'Qual é o menor país do mundo em área?',
      ['Mônaco', 'Vaticano', 'San Marino', 'Liechtenstein'],
      1,
      'Pense em um Estado inteiramente cercado pela cidade de Roma: o menor país do mundo é o Vaticano, com cerca de 0,44 km².',
      1,
      false,
    ],
    // added with the subtopics
    [
      'Qual é o maior estado do Brasil em área?',
      ['Pará', 'Amazonas', 'Mato Grosso', 'Minas Gerais'],
      1,
      'Compare a área dos estados da região Norte: o maior estado do Brasil é o Amazonas.',
      0,
      true,
    ],
    [
      'Qual bioma domina o sertão nordestino?',
      ['Cerrado', 'Caatinga', 'Pampa', 'Mata Atlântica'],
      1,
      'Pense no bioma semiárido exclusivo do Brasil: o sertão nordestino é dominado pela Caatinga.',
      0,
      true,
    ],
    [
      'Qual é o maior continente do mundo em área?',
      ['África', 'Ásia', 'América do Norte', 'Europa'],
      1,
      'Compare a área dos continentes: o maior é a Ásia.',
      1,
      true,
    ],
    [
      'Qual é a capital da França?',
      ['Lyon', 'Paris', 'Marselha', 'Bruxelas'],
      1,
      'Pense na cidade da Torre Eiffel: a capital da França é Paris.',
      1,
      true,
    ],
    [
      'Qual é a capital de Minas Gerais?',
      ['Uberlândia', 'Belo Horizonte', 'Juiz de Fora', 'Ouro Preto'],
      1,
      'Pense na capital planejada do estado, inaugurada em 1897: a capital de Minas Gerais é Belo Horizonte.',
      0,
      false,
    ],
    [
      'Em qual região do Brasil fica o Pantanal?',
      ['Norte', 'Nordeste', 'Centro-Oeste', 'Sul'],
      2,
      'Pense na maior planície alagável do mundo, entre Mato Grosso e Mato Grosso do Sul: o Pantanal fica no Centro-Oeste.',
      0,
      false,
    ],
    [
      'Qual é o maior país do mundo em área?',
      ['Canadá', 'China', 'Rússia', 'Estados Unidos'],
      2,
      'Pense no país que se estende pela Europa e pela Ásia, com 11 fusos horários: o maior país do mundo é a Rússia.',
      1,
      false,
    ],
    [
      'Qual bioma ocupa a maior parte do território brasileiro?',
      ['Cerrado', 'Amazônia', 'Mata Atlântica', 'Caatinga'],
      1,
      'Pense na maior floresta tropical do mundo: o bioma Amazônia cobre cerca de 49% do território brasileiro.',
      0,
      false,
    ],
  ],
);

const HISTORIA = subject(
  'demo-historia',
  [TOPIC_HIST_BRASIL_ID, TOPIC_HIST_GERAL_ID],
  [
    [
      'Em que ano o Brasil declarou a independência de Portugal?',
      ['1500', '1822', '1889', '1922'],
      1,
      'Lembre-se do grito do Ipiranga, dado por Dom Pedro I: a Independência do Brasil foi proclamada em 1822.',
      0,
      true,
    ],
    [
      'Quem foi o primeiro presidente do Brasil?',
      ['Getúlio Vargas', 'Deodoro da Fonseca', 'Dom Pedro II', 'Juscelino Kubitschek'],
      1,
      'Pense em quem comandou a Proclamação da República, em 1889: o primeiro presidente foi o marechal Deodoro da Fonseca.',
      0,
      true,
    ],
    [
      'A Revolução Francesa começou em que ano?',
      ['1689', '1789', '1889', '1815'],
      1,
      'Relacione a queda da Bastilha ao início da Revolução Francesa: o marco inicial foi 14 de julho de 1789.',
      1,
      true,
    ],
    [
      'Qual civilização construiu as pirâmides de Gizé?',
      ['Romana', 'Egípcia', 'Maia', 'Grega'],
      1,
      'Pense no povo que vivia às margens do rio Nilo e era governado por faraós: as pirâmides de Gizé foram construídas pelos egípcios.',
      1,
      true,
    ],
    [
      'Quem comandou a frota portuguesa que chegou ao Brasil em 1500?',
      ['Cristóvão Colombo', 'Pedro Álvares Cabral', 'Vasco da Gama', 'Dom João VI'],
      1,
      'Lembre-se da frota que chegou ao litoral da Bahia: o comandante foi Pedro Álvares Cabral.',
      0,
      false,
    ],
    [
      'Em que ano terminou a Segunda Guerra Mundial?',
      ['1918', '1939', '1945', '1950'],
      2,
      'Lembre-se da rendição do Japão, depois das bombas atômicas: a guerra terminou em 1945.',
      1,
      false,
    ],
    [
      'Qual lei aboliu a escravidão no Brasil?',
      ['Lei do Ventre Livre', 'Lei Áurea', 'Lei Eusébio de Queirós', 'Lei dos Sexagenários'],
      1,
      'Pense na lei assinada pela princesa Isabel em 1888: foi a Lei Áurea que aboliu a escravidão.',
      0,
      false,
    ],
    [
      'A queda do Muro de Berlim aconteceu em que ano?',
      ['1961', '1979', '1989', '1991'],
      2,
      'Relacione o muro ao fim da Guerra Fria na Europa: ele caiu em 1989.',
      1,
      false,
    ],
    // added with the subtopics
    [
      'Qual presidente criou a CLT, a lei trabalhista, em 1943?',
      ['Juscelino Kubitschek', 'Getúlio Vargas', 'Eurico Gaspar Dutra', 'Jânio Quadros'],
      1,
      'Pense no presidente que governou durante o Estado Novo: a CLT foi criada em 1943 por Getúlio Vargas.',
      0,
      true,
    ],
    [
      'O Brasil foi colônia de qual país até 1822?',
      ['Espanha', 'Portugal', 'França', 'Holanda'],
      1,
      'Pense em quem enviou a frota que chegou em 1500: o Brasil foi colônia de Portugal.',
      0,
      true,
    ],
    [
      'Em qual cidade grega nasceu a democracia?',
      ['Esparta', 'Atenas', 'Corinto', 'Tebas'],
      1,
      'Pense na cidade do Partenon, na Grécia Antiga: a democracia nasceu em Atenas.',
      1,
      true,
    ],
    [
      'Quem liderou a Alemanha nazista na Segunda Guerra Mundial?',
      ['Mussolini', 'Stalin', 'Adolf Hitler', 'Churchill'],
      2,
      'Pense no chefe do partido nazista, que chegou ao poder em 1933: o líder foi Adolf Hitler.',
      1,
      true,
    ],
    [
      'Que presidente construiu Brasília?',
      ['Getúlio Vargas', 'Juscelino Kubitschek', 'João Goulart', 'Café Filho'],
      1,
      'Lembre-se do lema "50 anos em 5": Brasília foi construída no governo de Juscelino Kubitschek.',
      0,
      false,
    ],
    [
      'Em que ano foi proclamada a República no Brasil?',
      ['1822', '1888', '1889', '1930'],
      2,
      'Pense no fim do Império de Dom Pedro II: a República foi proclamada em 1889.',
      0,
      false,
    ],
    [
      'Qual império construiu o Coliseu, em Roma?',
      ['Grego', 'Romano', 'Persa', 'Otomano'],
      1,
      'Pense no povo que deu nome à cidade e ao seu grande anfiteatro: o Coliseu foi construído pelo Império Romano.',
      1,
      false,
    ],
    [
      'Em que ano o ser humano pisou na Lua pela primeira vez?',
      ['1957', '1961', '1969', '1975'],
      2,
      'Relacione o feito à missão Apollo 11: o primeiro passo na Lua foi dado em 1969.',
      1,
      false,
    ],
  ],
);

const INGLES = subject(
  'demo-ingles',
  [TOPIC_ING_VOCAB_ID, TOPIC_ING_GRAM_ID],
  [
    [
      "Qual é a tradução de 'house' para o português?",
      ['Casa', 'Carro', 'Cachorro', 'Cadeira'],
      0,
      "Pense no lugar onde as pessoas moram: 'house' significa casa.",
      0,
      true,
    ],
    [
      "Complete a frase: 'She ___ a student.'",
      ['am', 'is', 'are', 'be'],
      1,
      "Lembre-se do verbo to be na terceira pessoa do singular: com 'she' usamos 'is'.",
      1,
      true,
    ],
    [
      "Qual é o plural de 'child'?",
      ['childs', 'childrens', 'children', 'childes'],
      2,
      "Lembre-se de que alguns substantivos têm plural irregular: o plural de 'child' é 'children'.",
      1,
      true,
    ],
    [
      "Complete a frase: 'I ___ to school every day.'",
      ['go', 'goes', 'going', 'gone'],
      0,
      "Observe o sujeito e o presente simples: com 'I' o verbo fica sem -s, ou seja, 'go'.",
      1,
      true,
    ],
    [
      "Como se diz 'obrigado' em inglês?",
      ['Please', 'Sorry', 'Thank you', 'Welcome'],
      2,
      "Pense na expressão de agradecimento mais comum: 'obrigado' é 'thank you'.",
      0,
      false,
    ],
    [
      "Qual é o oposto de 'hot'?",
      ['Warm', 'Cold', 'Big', 'Small'],
      1,
      "Pense na temperatura contrária: o oposto de 'hot' (quente) é 'cold' (frio).",
      0,
      false,
    ],
    [
      "Qual é o passado simples do verbo 'go'?",
      ['goed', 'went', 'gone', 'going'],
      1,
      "Lembre-se de que é um verbo irregular, que muda de forma no passado: o passado de 'go' é 'went'.",
      1,
      false,
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
      1,
      false,
    ],
    // added with the subtopics
    [
      "O que significa 'book'?",
      ['Livro', 'Caderno', 'Lápis', 'Mesa'],
      0,
      "Pense no objeto cheio de páginas para ler: 'book' significa livro.",
      0,
      true,
    ],
    [
      "Qual é a tradução de 'blue'?",
      ['Verde', 'Azul', 'Vermelho', 'Amarelo'],
      1,
      "Pense na cor do céu em um dia claro: 'blue' significa azul.",
      0,
      true,
    ],
    [
      "Como se diz 'cachorro' em inglês?",
      ['Cat', 'Dog', 'Bird', 'Fish'],
      1,
      "Pense no animal conhecido como o melhor amigo do homem: 'cachorro' em inglês é 'dog'.",
      0,
      true,
    ],
    [
      "Complete a frase: 'They ___ playing football.'",
      ['is', 'am', 'are', 'be'],
      2,
      "Observe o sujeito, que está no plural: com 'they' usamos 'are'.",
      1,
      true,
    ],
    [
      "Qual palavra significa 'janela'?",
      ['Door', 'Window', 'Wall', 'Floor'],
      1,
      "Pense na abertura da parede por onde entra luz: 'janela' é 'window'.",
      0,
      false,
    ],
    [
      "O que significa 'always'?",
      ['Nunca', 'Sempre', 'Às vezes', 'Raramente'],
      1,
      "Pense no advérbio de frequência que indica todas as vezes: 'always' significa sempre.",
      0,
      false,
    ],
    [
      "Qual é o plural de 'mouse'?",
      ['mouses', 'mice', 'mices', 'mousen'],
      1,
      "Lembre-se de que é um plural irregular, que muda de vogal: o plural de 'mouse' é 'mice'.",
      1,
      false,
    ],
    [
      "Complete a frase: 'She ___ TV every night.'",
      ['watch', 'watches', 'watching', 'watched'],
      1,
      "Observe o sujeito na terceira pessoa do singular no presente simples: o verbo ganha -es, ou seja, 'watches'.",
      1,
      false,
    ],
  ],
);

const CIENCIAS = subject(
  'demo-ciencias',
  [TOPIC_CIE_BIO_ID, TOPIC_CIE_FISQUI_ID],
  [
    [
      'Qual gás as plantas absorvem na fotossíntese?',
      ['Oxigênio', 'Gás carbônico', 'Nitrogênio', 'Hidrogênio'],
      1,
      'Pense no gás que as plantas retiram do ar para produzir alimento: elas absorvem gás carbônico e liberam oxigênio.',
      0,
      true,
    ],
    [
      'Qual é a unidade de medida da força no Sistema Internacional?',
      ['Joule', 'Newton', 'Watt', 'Pascal'],
      1,
      'Lembre-se do cientista da maçã e da gravidade: a unidade de força é o newton (N).',
      1,
      true,
    ],
    [
      'Qual é a fórmula química da água?',
      ['CO₂', 'H₂O', 'O₂', 'NaCl'],
      1,
      'Lembre-se dos elementos que formam a água: dois átomos de hidrogênio e um de oxigênio, ou seja, H₂O.',
      1,
      true,
    ],
    [
      'Qual órgão bombeia o sangue pelo corpo humano?',
      ['Pulmão', 'Fígado', 'Coração', 'Rim'],
      2,
      'Pense no órgão do sistema circulatório que pulsa o tempo todo: o coração bombeia o sangue para o corpo inteiro.',
      0,
      true,
    ],
    [
      'Em que estado físico a água está a 25 °C, ao nível do mar?',
      ['Sólido', 'Líquido', 'Gasoso', 'Plasma'],
      1,
      'Compare 25 °C com os pontos de congelamento (0 °C) e de ebulição (100 °C): a água está no estado líquido.',
      1,
      false,
    ],
    [
      'Qual é a principal fonte de energia da Terra?',
      ['Lua', 'Sol', 'Vento', 'Carvão'],
      1,
      'Pense na estrela que aquece e ilumina o planeta: o Sol é a principal fonte de energia da Terra.',
      1,
      false,
    ],
    [
      'Quantos ossos tem o corpo de um adulto?',
      ['106', '206', '306', '406'],
      1,
      'Lembre-se do número ensinado nas aulas de anatomia: um adulto tem 206 ossos.',
      0,
      false,
    ],
    [
      'O que acontece com a velocidade de um objeto em queda livre, sem resistência do ar?',
      ['Diminui', 'Aumenta', 'Permanece constante', 'Zera'],
      1,
      'Pense na gravidade agindo o tempo todo sobre o objeto: a velocidade aumenta cerca de 9,8 m/s a cada segundo.',
      1,
      false,
    ],
    // added with the subtopics
    [
      'Qual organela da célula produz energia na respiração celular?',
      ['Núcleo', 'Mitocôndria', 'Ribossomo', 'Vacúolo'],
      1,
      'Pense na "usina de energia" da célula: a respiração celular acontece na mitocôndria.',
      0,
      true,
    ],
    [
      'Qual é o maior órgão do corpo humano?',
      ['Fígado', 'Pele', 'Pulmão', 'Intestino'],
      1,
      'Pense no órgão que cobre o corpo inteiro: o maior órgão é a pele.',
      0,
      true,
    ],
    [
      'Qual é o símbolo químico do ouro?',
      ['Ag', 'Au', 'Fe', 'Or'],
      1,
      "Lembre-se da origem latina da palavra 'aurum': o símbolo do ouro é Au.",
      1,
      true,
    ],
    [
      'Qual é a temperatura de ebulição da água ao nível do mar?',
      ['50 °C', '90 °C', '100 °C', '120 °C'],
      2,
      'Pense no ponto em que a água vira vapor ao nível do mar: ela ferve a 100 °C.',
      1,
      true,
    ],
    [
      'Quantas câmaras tem o coração humano?',
      ['2', '3', '4', '5'],
      2,
      'Lembre-se da divisão do coração em átrios e ventrículos: ele tem 4 câmaras.',
      0,
      false,
    ],
    [
      'O que as vacinas estimulam o corpo a produzir?',
      ['Hormônios', 'Anticorpos', 'Vitaminas', 'Enzimas'],
      1,
      'Pense na defesa do organismo contra doenças: as vacinas estimulam a produção de anticorpos.',
      0,
      false,
    ],
    [
      'Qual é a velocidade aproximada da luz no vácuo?',
      ['3.000 km/s', '30.000 km/s', '300.000 km/s', '3.000.000 km/s'],
      2,
      'Lembre-se do valor usado para medir distâncias em anos-luz: a luz viaja a cerca de 300.000 km/s.',
      1,
      false,
    ],
    [
      'Qual vitamina a pele produz quando exposta ao sol?',
      ['A', 'C', 'D', 'K'],
      2,
      'Pense na vitamina ligada à exposição solar e à absorção de cálcio: é a vitamina D.',
      0,
      false,
    ],
  ],
);

// Ids follow this order, so the first 8 entries of every subject come first (they keep their ids).
const SUBJECTS = [GEOGRAFIA, HISTORIA, INGLES, CIENCIAS];
DRAFTS.push(...SUBJECTS.flatMap((s) => s.slice(0, 8)), ...SUBJECTS.flatMap((s) => s.slice(8)));

// Português: new subject, so all of its questions come after the others (ids stay stable).
const PORTUGUES = subject(
  'demo-portugues',
  [TOPIC_POR_ORTO_ID, TOPIC_POR_CLASSES_ID],
  [
    [
      'Qual palavra está escrita corretamente?',
      ['excessão', 'exceção', 'exeção', 'esceção'],
      1,
      'Lembre-se da regra dos substantivos derivados de "exceto": a grafia correta é exceção.',
      0,
      true,
    ],
    [
      'Qual é a grafia correta?',
      ['previlégio', 'privilégo', 'privilégio', 'preveilégio'],
      2,
      'Observe a origem da palavra, que vem do latim e tem o prefixo "privi-": a grafia correta é privilégio.',
      0,
      true,
    ],
    [
      'Qual palavra está acentuada corretamente?',
      ['heroi', 'herói', 'héroi', 'heróí'],
      1,
      'Lembre-se da regra dos ditongos abertos "ói" em palavras oxítonas: a forma correta é herói.',
      0,
      true,
    ],
    [
      'Qual frase está escrita corretamente?',
      [
        'Fui à escola ontem.',
        'Fui a escola ontem.',
        'Fui há escola ontem.',
        'Fui ah escola ontem.',
      ],
      0,
      'Observe que o verbo "ir" pede a preposição "a" e que "escola" pede o artigo "a": a crase é obrigatória em "Fui à escola ontem."',
      0,
      true,
    ],
    [
      'Qual palavra está escrita corretamente?',
      ['analizar', 'analisar', 'anallisar', 'analizár'],
      1,
      'Lembre-se de que o verbo vem do substantivo "análise", escrito com "s": a grafia correta é analisar.',
      0,
      false,
    ],
    [
      'Qual é a grafia correta?',
      ['obcessão', 'obseção', 'obsessão', 'obsseção'],
      2,
      'Lembre-se de que o sufixo -ssão forma substantivos de ação ou estado: a grafia correta é obsessão.',
      0,
      false,
    ],
    [
      'Qual palavra está acentuada corretamente?',
      ['util', 'útil', 'utíl', 'utill'],
      1,
      'Lembre-se da regra das paroxítonas terminadas em -l: a forma correta é útil.',
      0,
      false,
    ],
    [
      'Qual frase usa corretamente "mau" e "mal"?',
      ['Ele é um mau aluno.', 'Ele é um mal aluno.', 'Ele estuda mau.', 'Ele fez mau o trabalho.'],
      0,
      'Lembre-se de que "mau" é o oposto de "bom" e acompanha substantivos, enquanto "mal" é o oposto de "bem": a frase correta é "Ele é um mau aluno."',
      0,
      false,
    ],
    [
      'Qual é o substantivo da frase "O cachorro correu rápido."?',
      ['O', 'cachorro', 'correu', 'rápido'],
      1,
      'Procure a palavra que dá nome a um ser: o substantivo da frase é "cachorro".',
      1,
      true,
    ],
    [
      'Qual palavra é um verbo em "Maria canta uma música bonita."?',
      ['Maria', 'canta', 'uma', 'bonita'],
      1,
      'Procure a palavra que indica ação: o verbo da frase é "canta".',
      1,
      true,
    ],
    [
      'Qual é o plural de "cidadão"?',
      ['cidadões', 'cidadãos', 'cidadães', 'cidadans'],
      1,
      'Lembre-se de que alguns substantivos terminados em -ão fazem plural em -ãos: o plural de "cidadão" é "cidadãos".',
      1,
      true,
    ],
    [
      'Qual frase está de acordo com a concordância verbal?',
      [
        'Os alunos chegou cedo.',
        'Os alunos chegaram cedo.',
        'O alunos chegaram cedo.',
        'Os aluno chegaram cedo.',
      ],
      1,
      'Observe que o sujeito está no plural e o verbo precisa concordar com ele: "Os alunos chegaram cedo."',
      1,
      true,
    ],
    [
      'Qual palavra é um adjetivo em "O menino feliz brincou."?',
      ['menino', 'feliz', 'brincou', 'O'],
      1,
      'Procure a palavra que dá uma qualidade ao substantivo: o adjetivo é "feliz".',
      1,
      false,
    ],
    [
      'Qual é o antônimo de "generoso"?',
      ['Bondoso', 'Egoísta', 'Gentil', 'Alegre'],
      1,
      'Pense no oposto de quem divide o que tem: o antônimo de "generoso" é "egoísta".',
      1,
      false,
    ],
    [
      'Qual é o plural de "pão"?',
      ['pãos', 'pães', 'pões', 'pãoes'],
      1,
      'Lembre-se do plural em -ães de algumas palavras terminadas em -ão: o plural de "pão" é "pães".',
      1,
      false,
    ],
    [
      'Em "Choveu muito ontem.", qual é a classe da palavra "ontem"?',
      ['Substantivo', 'Adjetivo', 'Advérbio', 'Verbo'],
      2,
      'Observe que a palavra indica circunstância de tempo e não varia em gênero nem em número: "ontem" é um advérbio.',
      1,
      false,
    ],
  ],
);
DRAFTS.push(...PORTUGUES);

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
