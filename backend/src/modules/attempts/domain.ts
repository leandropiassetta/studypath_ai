import { createHash } from 'node:crypto';

/** Pure domain logic: no HTTP, no ORM. */

export interface QuestionKey {
  id: string;
  topicId: string;
  topicName: string;
  optionKeys: string[];
  correctOption: string;
  referenceExplanation: string;
}

export interface SubmittedAnswer {
  questionId: string;
  selectedOption: string;
}

export interface AnswerIssue {
  code: 'MISSING_ANSWER' | 'DUPLICATE_ANSWER' | 'UNKNOWN_QUESTION' | 'INVALID_OPTION';
  questionId: string;
}

export interface GradedAnswer extends SubmittedAnswer {
  correctOption: string;
  isCorrect: boolean;
  referenceExplanation: string;
}

export interface TopicResult {
  topicId: string;
  topicName: string;
  correctCount: number;
  totalCount: number;
  accuracyPct: number;
}

export interface GradedAttempt {
  correctCount: number;
  totalCount: number;
  scorePct: number;
  topicResults: TopicResult[];
  answers: GradedAnswer[];
}

/** correct / total * 100, rounded half-up to 2 decimals using integer math. */
export function percentage(correct: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((correct * 10000) / total) / 100;
}

/** RN-02: exactly one answer per quiz question, no duplicates, no outsiders, valid options. */
export function validateAnswers(
  questions: QuestionKey[],
  answers: SubmittedAnswer[],
): AnswerIssue[] {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const issues: AnswerIssue[] = [];
  const seen = new Set<string>();

  for (const a of answers) {
    const q = byId.get(a.questionId);
    if (!q) {
      issues.push({ code: 'UNKNOWN_QUESTION', questionId: a.questionId });
    } else if (seen.has(a.questionId)) {
      issues.push({ code: 'DUPLICATE_ANSWER', questionId: a.questionId });
    } else if (!q.optionKeys.includes(a.selectedOption)) {
      issues.push({ code: 'INVALID_OPTION', questionId: a.questionId });
    }
    seen.add(a.questionId);
  }
  for (const q of questions) {
    if (!seen.has(q.id)) issues.push({ code: 'MISSING_ANSWER', questionId: q.id });
  }
  return issues;
}

/**
 * RN-03: grade against the stored key. Input must already be valid (see validateAnswers).
 * `questions` must be in quiz order; answers and topic results follow that order.
 */
export function gradeAttempt(
  questions: QuestionKey[],
  submitted: SubmittedAnswer[],
): GradedAttempt {
  const selected = new Map(submitted.map((a) => [a.questionId, a.selectedOption]));
  const topics = new Map<string, TopicResult>();
  const answers: GradedAnswer[] = [];
  let correctCount = 0;

  for (const q of questions) {
    const selectedOption = selected.get(q.id) ?? '';
    const isCorrect = selectedOption === q.correctOption;
    if (isCorrect) correctCount += 1;
    answers.push({
      questionId: q.id,
      selectedOption,
      correctOption: q.correctOption,
      isCorrect,
      referenceExplanation: q.referenceExplanation,
    });

    const t = topics.get(q.topicId) ?? {
      topicId: q.topicId,
      topicName: q.topicName,
      correctCount: 0,
      totalCount: 0,
      accuracyPct: 0,
    };
    t.totalCount += 1;
    if (isCorrect) t.correctCount += 1;
    topics.set(q.topicId, t);
  }

  const topicResults = [...topics.values()].map((t) => ({
    ...t,
    accuracyPct: percentage(t.correctCount, t.totalCount),
  }));
  return {
    correctCount,
    totalCount: questions.length,
    scorePct: percentage(correctCount, questions.length),
    topicResults,
    answers,
  };
}

/** RN-05: SHA-256 over quizId + answers sorted by questionId (order-independent). */
export function canonicalPayloadHash(quizId: string, answers: SubmittedAnswer[]): string {
  const sorted = [...answers]
    .sort((a, b) => (a.questionId < b.questionId ? -1 : a.questionId > b.questionId ? 1 : 0))
    .map((a) => [a.questionId, a.selectedOption]);
  return createHash('sha256')
    .update(JSON.stringify({ quizId, answers: sorted }))
    .digest('hex');
}
