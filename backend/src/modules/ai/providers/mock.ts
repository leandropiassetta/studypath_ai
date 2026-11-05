import type { ExplanationInput, ExplanationProvider } from './types.js';

/** Deterministic stand-in for an LLM: no network, no key. Used for demos and tests. */
export class MockExplanationProvider implements ExplanationProvider {
  async explain(input: ExplanationInput): Promise<unknown> {
    return {
      explanation:
        `[mock] Você marcou ${input.selectedOption}, mas a alternativa correta é ` +
        `${input.correctOption}. ${input.referenceExplanation}`,
    };
  }
}
