/** Pure domain logic for RN-06..RN-09: deterministic, no HTTP, no ORM, no LLM. */

export type Priority = 'HIGH' | 'LOW';

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

/** An answer tied to its question and attempt, newest attempts identified by order. */
export interface HistoricAnswer extends AnswerFact {
  questionId: string;
  attemptId: string;
}

export interface AttemptSummary {
  id: string;
  submittedAt: Date;
  scorePct: number;
}

export interface ProgressTopic {
  topicId: string;
  topicName: string;
  correctCount: number;
  totalCount: number;
  accuracyPct: number;
}

export interface ProgressPoint {
  attemptId: string;
  submittedAt: Date;
  scorePct: number;
  topics: ProgressTopic[];
}

export interface ReviewTopic extends TopicPerformance {
  priority: Priority;
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
 * RN-06 (current state): for each question keep only its most recent answer.
 * A question missed before but answered correctly later counts as correct now, so old
 * mistakes stop weighing on topics the student has since fixed.
 * `attemptIdsNewestFirst` defines recency (index 0 = most recent attempt).
 */
export function latestAnswerPerQuestion(
  answers: HistoricAnswer[],
  attemptIdsNewestFirst: string[],
): HistoricAnswer[] {
  const rank = new Map(attemptIdsNewestFirst.map((id, i) => [id, i]));
  const latest = new Map<string, HistoricAnswer>();
  for (const a of answers) {
    const r = rank.get(a.attemptId);
    if (r === undefined) continue;
    const current = latest.get(a.questionId);
    if (current === undefined || r < (rank.get(current.attemptId) as number)) {
      latest.set(a.questionId, a);
    }
  }
  return [...latest.values()];
}

/** Per-attempt performance by topic, oldest first, so the UI can show the trajectory. */
export function buildProgress(
  answers: HistoricAnswer[],
  attemptsNewestFirst: AttemptSummary[],
): ProgressPoint[] {
  return [...attemptsNewestFirst].reverse().map((attempt) => ({
    attemptId: attempt.id,
    submittedAt: attempt.submittedAt,
    scorePct: attempt.scorePct,
    topics: summarizeByTopic(answers.filter((a) => a.attemptId === attempt.id))
      .map((t) => ({
        topicId: t.topicId,
        topicName: t.topicName,
        correctCount: t.correctCount,
        totalCount: t.answeredCount,
        accuracyPct: t.accuracyPct,
      }))
      .sort((a, b) => cmp(a.topicName, b.topicName)),
  }));
}

const compareTopics = (a: TopicPerformance, b: TopicPerformance): number =>
  // compare ratios exactly: a.c / a.n vs b.c / b.n
  a.correctCount * b.answeredCount - b.correctCount * a.answeredCount ||
  b.answeredCount - a.answeredCount ||
  cmp(a.topicName, b.topicName);

/**
 * RN-07: topics with at least 2 answers and any mistake are worth reviewing.
 *  - HIGH: accuracy < 60%.
 *  - LOW ("optional review"): 60% <= accuracy < 100%.
 * HIGH topics come first; inside each priority: accuracy ascending, answeredCount
 * descending, topic name ascending.
 */
export function selectReviewTopics(facts: AnswerFact[]): ReviewTopic[] {
  const eligible = summarizeByTopic(facts)
    .filter((t) => t.answeredCount >= MIN_ANSWERED && t.correctCount < t.answeredCount)
    .map<ReviewTopic>((t) => ({
      ...t,
      priority: t.correctCount * 100 < LOW_ACCURACY_PERCENT * t.answeredCount ? 'HIGH' : 'LOW',
    }));
  const byPriority = (p: Priority): ReviewTopic[] =>
    eligible.filter((t) => t.priority === p).sort(compareTopics);
  return [...byPriority('HIGH'), ...byPriority('LOW')];
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

/** RN-09: ON_TRACK only when there is nothing to review (no mistakes in eligible topics). */
export function overallStatus(
  evaluatedAttempts: number,
  reviewTopics: number,
): RecommendationStatus {
  if (evaluatedAttempts === 0) return 'NO_HISTORY';
  return reviewTopics > 0 ? 'NEEDS_REVIEW' : 'ON_TRACK';
}
