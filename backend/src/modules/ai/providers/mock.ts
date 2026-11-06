import type { AnalysisInput, ExplanationInput, ExplanationProvider, HintInput } from './types.js';

/** Deterministic stand-in for an LLM: no network, no key. Used for demos and tests. */
export class MockExplanationProvider implements ExplanationProvider {
  async explain(input: ExplanationInput): Promise<unknown> {
    return {
      explanation:
        `[mock] Você marcou ${input.selectedOption}, mas a alternativa correta é ` +
        `${input.correctOption}. ${input.referenceExplanation}`,
    };
  }

  async analyze(input: AnalysisInput): Promise<unknown> {
    return {
      misconception: `[mock] Marcou ${input.selectedOption} em vez de ${input.correctOption}: provável confusão no passo central do método.`,
    };
  }

  async hint(input: HintInput): Promise<unknown> {
    const nudge = input.studentMessage ? ` Sobre "${input.studentMessage}":` : '';
    switch (input.level) {
      case 1:
        return {
          hint: `[mock] Dica 1.${nudge} Releia o enunciado: o que a questão pede e qual conceito ajuda aqui?`,
        };
      case 2:
        return {
          hint: `[mock] Dica 2.${nudge} Pense no primeiro passo do método antes de calcular qualquer coisa.`,
        };
      default:
        return {
          hint: `[mock] Dica 3. A alternativa correta é ${input.correctOption}. ${input.referenceExplanation}`,
        };
    }
  }
}
