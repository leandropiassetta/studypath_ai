import { Type } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import { MAX_EXPLANATION_CHARS } from './prompt.js';

const ExplanationOutput = Type.Object(
  { explanation: Type.String({ minLength: 1, maxLength: MAX_EXPLANATION_CHARS }) },
  { additionalProperties: false },
);

/**
 * Some models double-escape line breaks inside the JSON string, so the app would show a literal
 * "\\n". Turn those into real line breaks (and collapse long runs of them).
 */
export function normalizeModelText(text: string): string {
  return text
    .replace(/\\r\\n|\\n|\\r/g, '\n')
    .replace(/\\t/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Returns the explanation text if the model output has the expected shape, else null. */
export function parseExplanation(raw: unknown): string | null {
  let value = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!Value.Check(ExplanationOutput, value)) return null;
  const text = normalizeModelText(value.explanation);
  return text.length > 0 ? text : null;
}

const HintOutput = Type.Object(
  { hint: Type.String({ minLength: 1, maxLength: 700 }) },
  { additionalProperties: false },
);

/** Returns the hint text if the model output has the expected shape, else null. */
export function parseHint(raw: unknown): string | null {
  let value = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!Value.Check(HintOutput, value)) return null;
  const text = normalizeModelText(value.hint);
  return text.length > 0 ? text : null;
}

const AnalysisOutput = Type.Object(
  { misconception: Type.String({ minLength: 1, maxLength: 300 }) },
  { additionalProperties: false },
);

/** Returns the misconception text if the model output has the expected shape, else null. */
export function parseAnalysis(raw: unknown): string | null {
  let value = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!Value.Check(AnalysisOutput, value)) return null;
  const text = normalizeModelText(value.misconception);
  return text.length > 0 ? text : null;
}
