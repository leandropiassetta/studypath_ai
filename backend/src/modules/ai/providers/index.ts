import type { Env } from '../../../config/env.js';
import { AnthropicExplanationProvider } from './anthropic.js';
import { MockExplanationProvider } from './mock.js';
import { OpenAIExplanationProvider } from './openai.js';
import type { ExplanationProvider } from './types.js';

export function createExplanationProvider(env: Env): ExplanationProvider | null {
  switch (env.AI_MODE) {
    case 'mock':
      return new MockExplanationProvider();
    case 'real':
      // loadEnv guarantees key and model in real mode.
      return env.LLM_PROVIDER === 'openai'
        ? new OpenAIExplanationProvider({
            apiKey: env.LLM_API_KEY as string,
            model: env.LLM_MODEL as string,
            baseUrl: env.LLM_BASE_URL?.replace(/\/+$/, ''),
          })
        : new AnthropicExplanationProvider({
            apiKey: env.LLM_API_KEY as string,
            model: env.LLM_MODEL as string,
          });
    default:
      return null;
  }
}
