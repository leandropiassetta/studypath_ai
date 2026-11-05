import { Type, type Static } from '@sinclair/typebox';
import { QuizResponse } from '../quizzes/schemas.js';

export const ReviewParams = Type.Object({ studentId: Type.String({ format: 'uuid' }) });
export const ReviewBody = Type.Object(
  { topicId: Type.String({ format: 'uuid' }) },
  { additionalProperties: false },
);
export type ReviewRequest = Static<typeof ReviewBody>;

// Same allow-list as a normal quiz (no answer key), plus how the questions were chosen.
export const ReviewQuizResponse = Type.Object({
  ...QuizResponse.properties,
  newCount: Type.Integer(),
  retryCount: Type.Integer(),
});
export type ReviewQuizView = Static<typeof ReviewQuizResponse>;
