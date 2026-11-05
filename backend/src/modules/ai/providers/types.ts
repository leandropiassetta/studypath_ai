/** What the model is allowed to see: the question and the student's wrong choice. Nothing else. */
export interface ExplanationInput {
  statement: string;
  options: { key: string; text: string }[];
  selectedOption: string;
  correctOption: string;
  referenceExplanation: string;
}

/**
 * Boundary to an LLM. It returns UNTRUSTED data (`unknown`); the service validates it.
 * Implementations must honour `signal` but the service enforces the timeout regardless.
 */
export interface ExplanationProvider {
  explain(input: ExplanationInput, signal: AbortSignal): Promise<unknown>;
}
