import { Type, type Static } from '@sinclair/typebox';

export const ExplanationParams = Type.Object({ attemptId: Type.String({ format: 'uuid' }) });
export const ExplanationBody = Type.Object(
  { questionId: Type.String({ format: 'uuid' }) },
  { additionalProperties: false },
);
export type ExplanationRequest = Static<typeof ExplanationBody>;

export const ExplanationResponse = Type.Object({
  questionId: Type.String(),
  explanation: Type.String(),
  source: Type.Union([Type.Literal('llm'), Type.Literal('reference')]),
});
export type ExplanationView = Static<typeof ExplanationResponse>;
