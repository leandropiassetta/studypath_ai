import { Type, type Static } from '@sinclair/typebox';

export const StudentParams = Type.Object({ studentId: Type.String({ format: 'uuid' }) });

const SuggestedQuestion = Type.Object({
  id: Type.String(),
  statement: Type.String(),
  options: Type.Array(Type.Object({ key: Type.String(), text: Type.String() })),
  difficulty: Type.Union([Type.Literal('easy'), Type.Literal('medium'), Type.Literal('hard')]),
});

// Response schema is an allow-list: the answer key can never be serialized from here.
export const RecommendationsResponse = Type.Object({
  studentId: Type.String(),
  status: Type.Union([
    Type.Literal('NO_HISTORY'),
    Type.Literal('ON_TRACK'),
    Type.Literal('NEEDS_REVIEW'),
  ]),
  evaluatedAttempts: Type.Integer(),
  // Oldest to newest, same window as the evaluation: lets the client show the trajectory.
  progress: Type.Array(
    Type.Object({
      attemptId: Type.String(),
      submittedAt: Type.String(),
      scorePct: Type.Number(),
      topics: Type.Array(
        Type.Object({
          topicId: Type.String(),
          topicName: Type.String(),
          correctCount: Type.Integer(),
          totalCount: Type.Integer(),
          accuracyPct: Type.Number(),
        }),
      ),
    }),
  ),
  topics: Type.Array(
    Type.Object({
      topicId: Type.String(),
      topicName: Type.String(),
      priority: Type.Union([Type.Literal('HIGH'), Type.Literal('LOW')]),
      correctCount: Type.Integer(),
      answeredCount: Type.Integer(),
      accuracyPct: Type.Number(),
      status: Type.Union([Type.Literal('AVAILABLE'), Type.Literal('NO_NEW_QUESTIONS')]),
      message: Type.Optional(Type.String()),
      suggestedQuestions: Type.Array(SuggestedQuestion),
    }),
  ),
});
export type RecommendationsView = Static<typeof RecommendationsResponse>;
