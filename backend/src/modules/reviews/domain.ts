import { createHash } from 'node:crypto';
import {
  MAX_SUGGESTIONS,
  selectSuggestions,
  type CandidateQuestion,
} from '../recommendations/domain.js';

export interface ReviewSelection {
  questionIds: string[];
  /** Questions the student has never answered. */
  newCount: number;
  /** Questions answered before whose latest answer is still wrong. */
  retryCount: number;
}

/**
 * Review quiz content for one topic: up to 3 unseen questions first (RN-08 order); if fewer
 * than 3 exist, the quiz is topped up with questions that are still wrong (latest answer).
 */
export function composeReviewSelection(
  unseen: CandidateQuestion[],
  stillWrong: CandidateQuestion[],
): ReviewSelection {
  const fresh = selectSuggestions(unseen);
  const taken = new Set(fresh.map((q) => q.id));
  const retry = selectSuggestions(stillWrong.filter((q) => !taken.has(q.id))).slice(
    0,
    MAX_SUGGESTIONS - fresh.length,
  );
  return {
    questionIds: [...fresh, ...retry].map((q) => q.id),
    newCount: fresh.length,
    retryCount: retry.length,
  };
}

/** Same set of questions -> same slug, so asking for the same review twice reuses one quiz. */
export function reviewSlug(questionIds: string[]): string {
  const digest = createHash('sha256')
    .update([...questionIds].sort().join(','))
    .digest('hex');
  return `revisao-${digest.slice(0, 16)}`;
}
