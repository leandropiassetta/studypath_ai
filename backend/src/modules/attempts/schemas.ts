import { Type, type Static } from '@sinclair/typebox';

export const CreateAttemptBody = Type.Object(
  {
    requestId: Type.String({ format: 'uuid' }),
    studentId: Type.String({ format: 'uuid' }),
    quizId: Type.String({ format: 'uuid' }),
    answers: Type.Array(
      Type.Object(
        {
          questionId: Type.String({ format: 'uuid' }),
          selectedOption: Type.String({ minLength: 1, maxLength: 8 }),
        },
        { additionalProperties: false },
      ),
      { minItems: 1, maxItems: 100 },
    ),
  },
  { additionalProperties: false },
);
export type CreateAttemptInput = Static<typeof CreateAttemptBody>;

export const AttemptResponse = Type.Object({
  attemptId: Type.String(),
  quizId: Type.String(),
  correctCount: Type.Integer(),
  totalCount: Type.Integer(),
  scorePct: Type.Number(),
  topicResults: Type.Array(
    Type.Object({
      topicId: Type.String(),
      topicName: Type.String(),
      correctCount: Type.Integer(),
      totalCount: Type.Integer(),
      accuracyPct: Type.Number(),
    }),
  ),
  answers: Type.Array(
    Type.Object({
      questionId: Type.String(),
      selectedOption: Type.String(),
      correctOption: Type.String(),
      isCorrect: Type.Boolean(),
      referenceExplanation: Type.String(),
    }),
  ),
});
export type AttemptResult = Static<typeof AttemptResponse>;
