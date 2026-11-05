import { Type, type Static } from '@sinclair/typebox';

export const QuizParams = Type.Object({
  slug: Type.String({ pattern: '^[a-z0-9]+(-[a-z0-9]+)*$', maxLength: 120 }),
});

// Response schema doubles as an allow-list: fields not listed here are never serialized,
// so the answer key cannot leak even if a query starts selecting it.
export const QuizResponse = Type.Object({
  id: Type.String(),
  slug: Type.String(),
  title: Type.String(),
  questions: Type.Array(
    Type.Object({
      id: Type.String(),
      topic: Type.Object({ id: Type.String(), name: Type.String() }),
      statement: Type.String(),
      options: Type.Array(Type.Object({ key: Type.String(), text: Type.String() })),
      difficulty: Type.Union([Type.Literal('easy'), Type.Literal('medium'), Type.Literal('hard')]),
    }),
  ),
});

export type QuizView = Static<typeof QuizResponse>;
