import type { DataSource } from 'typeorm';
import type { ExplanationInput } from './providers/types.js';

export interface AnswerContext extends ExplanationInput {
  studentId: string;
  isCorrect: boolean;
}

export type AnswerLookup =
  | { found: 'no-attempt' }
  | { found: 'no-answer'; studentId: string }
  | { found: 'answer'; context: AnswerContext };

interface Row {
  student_id: string;
  question_id: string | null;
  selected_option: string | null;
  is_correct: boolean | null;
  statement: string | null;
  options: { key: string; text: string }[] | null;
  correct_option: string | null;
  reference_explanation: string | null;
}

/** Read-only: this module never writes to the database (explanations are not persisted). */
export class ExplanationRepository {
  constructor(private readonly ds: DataSource) {}

  async findAnswer(attemptId: string, questionId: string): Promise<AnswerLookup> {
    const rows = await this.ds.query<Row[]>(
      `SELECT a.student_id, aa.question_id, aa.selected_option, aa.is_correct,
              q.statement, q.options, q.correct_option, q.reference_explanation
       FROM attempts a
       LEFT JOIN attempt_answers aa ON aa.attempt_id = a.id AND aa.question_id = $2
       LEFT JOIN questions q ON q.id = aa.question_id
       WHERE a.id = $1`,
      [attemptId, questionId],
    );
    const row = rows[0];
    if (!row) return { found: 'no-attempt' };
    if (row.question_id === null) return { found: 'no-answer', studentId: row.student_id };
    return {
      found: 'answer',
      context: {
        studentId: row.student_id,
        isCorrect: row.is_correct as boolean,
        statement: row.statement as string,
        options: row.options as { key: string; text: string }[],
        selectedOption: row.selected_option as string,
        correctOption: row.correct_option as string,
        referenceExplanation: row.reference_explanation as string,
      },
    };
  }
}
