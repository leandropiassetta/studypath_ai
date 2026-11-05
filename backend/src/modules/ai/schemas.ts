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
  /** Present when the LLM was skipped on purpose (usage limit), so the UI can explain why. */
  notice: Type.Optional(Type.String()),
});
export type ExplanationView = Static<typeof ExplanationResponse>;
