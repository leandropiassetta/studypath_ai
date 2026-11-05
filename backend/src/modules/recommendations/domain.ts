/** Pure domain logic for RN-06..RN-09: deterministic, no HTTP, no ORM, no LLM. */

export const RECENT_ATTEMPTS_WINDOW = 5;
export const MIN_ANSWERED = 2;
/** Accuracy strictly below 60% is "low" (expressed as integers to avoid float error). */
export const LOW_ACCURACY_PERCENT = 60;
export const MAX_SUGGESTIONS = 3;

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface AnswerFact {
  topicId: string;
  topicName: string;
  isCorrect: boolean;
}

export interface TopicPerformance {
  topicId: string;
  topicName: string;
  correctCount: number;
  answeredCount: number;
  accuracyPct: number;
}

export interface CandidateQuestion {
  id: string;
  difficulty: Difficulty;
  createdAt: Date;
}

export type RecommendationStatus = 'NO_HISTORY' | 'ON_TRACK' | 'NEEDS_REVIEW';

const DIFFICULTY_RANK: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2 };

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Groups answers by topic. */
export function summarizeByTopic(facts: AnswerFact[]): TopicPerformance[] {
  const map = new Map<string, TopicPerformance>();
  for (const f of facts) {
    const t = map.get(f.topicId) ?? {
      topicId: f.topicId,
      topicName: f.topicName,
      correctCount: 0,
      answeredCount: 0,
      accuracyPct: 0,
    };
    t.answeredCount += 1;
    if (f.isCorrect) t.correctCount += 1;
    map.set(f.topicId, t);
  }
  return [...map.values()].map((t) => ({
    ...t,
    accuracyPct: Math.round((t.correctCount * 10000) / t.answeredCount) / 100,
  }));
}

/**
 * RN-07: HIGH priority when answeredCount >= 2 and accuracy < 60%.
 * Order: accuracy ascending, answeredCount descending, topic name ascending.
 */
export function selectPriorityTopics(facts: AnswerFact[]): TopicPerformance[] {
  return summarizeByTopic(facts)
    .filter(
      (t) =>
        t.answeredCount >= MIN_ANSWERED &&
        t.correctCount * 100 < LOW_ACCURACY_PERCENT * t.answeredCount,
    )
    .sort(
      (a, b) =>
        // compare ratios exactly: a.c / a.n vs b.c / b.n
        a.correctCount * b.answeredCount - b.correctCount * a.answeredCount ||
        b.answeredCount - a.answeredCount ||
        cmp(a.topicName, b.topicName),
    );
}

/** RN-08: up to 3 questions ordered by difficulty, creation date and id. */
export function selectSuggestions<T extends CandidateQuestion>(candidates: T[]): T[] {
  return [...candidates]
    .sort(
      (a, b) =>
        DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty] ||
        a.createdAt.getTime() - b.createdAt.getTime() ||
        cmp(a.id, b.id),
    )
    .slice(0, MAX_SUGGESTIONS);
}

/** RN-09 */
export function overallStatus(
  evaluatedAttempts: number,
  priorityTopics: number,
): RecommendationStatus {
  if (evaluatedAttempts === 0) return 'NO_HISTORY';
  return priorityTopics > 0 ? 'NEEDS_REVIEW' : 'ON_TRACK';
}
