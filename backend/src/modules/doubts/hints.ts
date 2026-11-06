import type { HintInput, HintLevel } from '../ai/providers/types.js';

const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Levels 1 and 2 must not give the answer away. The model is told so, but a prompt is a request,
 * not a guarantee, so the output is checked: it must not name the correct alternative or state
 * the final value.
 */
export function leaksAnswer(hint: string, input: HintInput): boolean {
  const key = escape(input.correctOption);
  const naming = new RegExp(
    `(alternativa|letra|op[cç][aã]o|gabarito|resposta)(\\s+correta)?\\s*(é|seria|:|-)?\\s*\\(?${key}\\)?(?![\\p{L}\\p{N}])`,
    'iu',
  );
  if (naming.test(hint)) return true;

  const correct = input.options.find((o) => o.key === input.correctOption)?.text.trim();
  if (correct) {
    const value = escape(correct);
    // "x = 5", "A resposta é 5", "Resultado: 5", "A solução final é 5", "O valor correto é 5",
    // "dá 5", "vale 5", "10 / 2 = 5": any way of stating the final value. Still a heuristic: it
    // lowers the chance of an early leak, it does not prove there is none.
    const stating = new RegExp(
      `(\\b[a-z]\\s*=|=|igual a|` +
        `(solu[cç][aã]o|valor|resultado|resposta|n[uú]mero|total)(\\s+(final|correta|correto|certa|certo))?\\s*(é|=|:|seria|fica|vale)|` +
        `(?<![\\p{L}\\p{N}])(d[aá]|vale|fica|resulta em|chega a)(?![\\p{L}\\p{N}]))\\s*${value}(?![\\p{L}\\p{N}])`,
      'iu',
    );
    if (stating.test(hint)) return true;
    // Non-math subjects: the answer is a word or a name ("Brasília", "went"). Saying it outright
    // gives it away, unless the question itself already says it.
    const isWord = /\p{L}/u.test(correct) && correct.length >= 3;
    if (isWord && !input.statement.toLowerCase().includes(correct.toLowerCase())) {
      const word = new RegExp(`(?<![\\p{L}\\p{N}])${value}(?![\\p{L}\\p{N}])`, 'iu');
      if (word.test(hint)) return true;
    }
  }
  return false;
}

/** The method cue of the reference explanation: what comes before the first ":" (no result yet). */
function methodCue(reference: string): string {
  const beforeColon = reference.split(':')[0]?.trim();
  if (beforeColon && beforeColon.length < reference.trim().length) return beforeColon;
  const firstSentence = reference
    .split(/(?<=[.!?])\s/)[0]
    ?.split('=')[0]
    ?.trim();
  return firstSentence && firstSentence.length > 0 ? firstSentence : 'Revise o método';
}

/** Deterministic hints from the stored reference explanation: used when the AI is off, fails or leaks. */
export function referenceHint(input: HintInput, level: HintLevel): string {
  switch (level) {
    case 1:
      return 'Releia o enunciado com calma e identifique o que a questão pede. Qual conceito você usaria para começar?';
    case 2:
      return `Dica: ${methodCue(input.referenceExplanation).replace(/[.:]+$/, '')}. Use essa pista antes de escolher a alternativa.`;
    default:
      return `${input.referenceExplanation} A alternativa correta é ${input.correctOption}.`;
  }
}
