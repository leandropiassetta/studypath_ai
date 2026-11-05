import type { Env } from '../../../config/env.js';
import { AnthropicExplanationProvider } from './anthropic.js';
import { MockExplanationProvider } from './mock.js';
import type { ExplanationProvider } from './types.js';

export function createExplanationProvider(env: Env): ExplanationProvider | null {
  switch (env.AI_MODE) {
    case 'mock':
      return new MockExplanationProvider();
    case 'real':
      // loadEnv guarantees both values in real mode.
      return new AnthropicExplanationProvider({
        apiKey: env.LLM_API_KEY as string,
        model: env.LLM_MODEL as string,
      });
    default:
      return null;
  }
}
