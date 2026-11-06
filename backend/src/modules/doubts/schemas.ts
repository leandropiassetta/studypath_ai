import { Type, type Static } from '@sinclair/typebox';

export const MAX_HINTS = 3;

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
