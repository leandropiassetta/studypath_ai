import {
  buildHintMessage,
  buildUserMessage,
  HINT_SYSTEM_PROMPT,
  SYSTEM_PROMPT,
} from '../prompt.js';
import type { ExplanationInput, ExplanationProvider, HintInput } from './types.js';

export interface AnthropicOptions {
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

/** Calls the Anthropic Messages API over plain fetch (no SDK dependency). */
export class AnthropicExplanationProvider implements ExplanationProvider {
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;

  constructor(private readonly options: AnthropicOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.baseUrl = options.baseUrl ?? 'https://api.anthropic.com';
  }

  explain(input: ExplanationInput, signal: AbortSignal): Promise<unknown> {
    return this.message(SYSTEM_PROMPT, buildUserMessage(input), signal);
  }

  hint(input: HintInput, signal: AbortSignal): Promise<unknown> {
    return this.message(HINT_SYSTEM_PROMPT, buildHintMessage(input), signal);
  }

  private async message(system: string, user: string, signal: AbortSignal): Promise<unknown> {
    const res = await this.fetchImpl(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.options.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.options.model,
        max_tokens: 500,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    // Status only: never put the response body or the key in the error (it ends up in logs).
    if (!res.ok) throw new Error(`LLM request failed with status ${res.status}`);

    const body = (await res.json()) as { content?: { type?: string; text?: string }[] };
    const block = body.content?.find((c) => c.type === 'text');
    return block?.text ?? null;
  }
}
