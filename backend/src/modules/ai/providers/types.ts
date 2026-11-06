/** What the model is allowed to see: the question and the student's wrong choice. Nothing else. */
export interface ExplanationInput {
  statement: string;
  options: { key: string; text: string }[];
  selectedOption: string;
  correctOption: string;
  referenceExplanation: string;
}

export type HintLevel = 1 | 2 | 3;

/** Same data as an explanation, plus how far the guidance may go and what the student wrote. */
export interface HintInput extends ExplanationInput {
  level: HintLevel;
  /** Optional free text from the student. UNTRUSTED: it is data, never instructions. */
  studentMessage?: string;
}

/**
 * Boundary to an LLM. It returns UNTRUSTED data (`unknown`); the service validates it.
 * Implementations must honour `signal` but the service enforces the timeout regardless.
 */
export interface ExplanationProvider {
  explain(input: ExplanationInput, signal: AbortSignal): Promise<unknown>;
  /** Optional: providers without it make the doubt flow use the reference hints. */
  hint?(input: HintInput, signal: AbortSignal): Promise<unknown>;
}
