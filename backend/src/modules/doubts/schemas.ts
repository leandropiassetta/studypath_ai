import { Type, type Static } from '@sinclair/typebox';

export const MAX_HINTS = 3;
/** Promised response time shown to the student (a target, not a guarantee). */
export const ETA_MINUTES = 14;

export const CreateDoubtBody = Type.Object(
  {
    attemptId: Type.String({ format: 'uuid' }),
    questionId: Type.String({ format: 'uuid' }),
    message: Type.Optional(Type.String({ minLength: 1, maxLength: 300 })),
  },
  { additionalProperties: false },
);
export type CreateDoubtInput = Static<typeof CreateDoubtBody>;

export const DoubtParams = Type.Object({ doubtId: Type.String({ format: 'uuid' }) });

const HintView = Type.Object({
  level: Type.Integer(),
  text: Type.String(),
  source: Type.Union([Type.Literal('llm'), Type.Literal('reference')]),
});

export const DoubtResponse = Type.Object({
  id: Type.String(),
  attemptId: Type.String(),
  questionId: Type.String(),
  status: Type.Union([
    Type.Literal('AI_HINTS'),
    Type.Literal('WAITING_TEACHER'),
    Type.Literal('ANSWERED'),
  ]),
  message: Type.Union([Type.String(), Type.Null()]),
  hintsUsed: Type.Integer(),
  maxHints: Type.Integer(),
  hints: Type.Array(HintView),
  teacherRequestedAt: Type.Union([Type.String(), Type.Null()]),
  etaMinutes: Type.Integer(),
  teacherAnswer: Type.Union([Type.String(), Type.Null()]),
  answeredAt: Type.Union([Type.String(), Type.Null()]),
  aiHelpful: Type.Union([Type.Boolean(), Type.Null()]),
  teacherHelpful: Type.Union([Type.Boolean(), Type.Null()]),
});
export type DoubtView = Static<typeof DoubtResponse>;

export const HintResponse = Type.Object({
  level: Type.Integer(),
  text: Type.String(),
  source: Type.Union([Type.Literal('llm'), Type.Literal('reference')]),
  /** Present when the AI was skipped on purpose (usage limit). */
  notice: Type.Optional(Type.String()),
  hintsUsed: Type.Integer(),
  hasMore: Type.Boolean(),
});
export type HintResult = Static<typeof HintResponse>;

export const FeedbackBody = Type.Object(
  { aiHelpful: Type.Optional(Type.Boolean()), teacherHelpful: Type.Optional(Type.Boolean()) },
  { additionalProperties: false, minProperties: 1 },
);
export type FeedbackInput = Static<typeof FeedbackBody>;

export const TeacherQueueQuery = Type.Object({
  status: Type.Optional(Type.Union([Type.Literal('waiting'), Type.Literal('answered')])),
});

export const TeacherAnswerBody = Type.Object(
  { answer: Type.String({ minLength: 1, maxLength: 2000 }) },
  { additionalProperties: false },
);
export type TeacherAnswerInput = Static<typeof TeacherAnswerBody>;

/** What a teacher sees: the question, the student's choice, the AI's hints and the student's note. */
export const TeacherDoubtResponse = Type.Object({
  id: Type.String(),
  status: Type.Union([Type.Literal('WAITING_TEACHER'), Type.Literal('ANSWERED')]),
  studentFirstName: Type.String(),
  topic: Type.String(),
  statement: Type.String(),
  options: Type.Array(Type.Object({ key: Type.String(), text: Type.String() })),
  selectedOption: Type.String(),
  correctOption: Type.String(),
  referenceExplanation: Type.String(),
  message: Type.Union([Type.String(), Type.Null()]),
  misconception: Type.Union([Type.String(), Type.Null()]),
  hintsUsed: Type.Integer(),
  aiHints: Type.Array(HintView),
  requestedAt: Type.String(),
  waitingMinutes: Type.Integer(),
  /** True when it waited past the promised time (flagged by the delayed job). */
  slaBreached: Type.Boolean(),
  answer: Type.Union([Type.String(), Type.Null()]),
  answeredAt: Type.Union([Type.String(), Type.Null()]),
});
export type TeacherDoubtView = Static<typeof TeacherDoubtResponse>;

export const TeacherQueueResponse = Type.Array(TeacherDoubtResponse);
