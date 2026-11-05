import { buildUserMessage, SYSTEM_PROMPT } from '../prompt.js';
import type { ExplanationInput, ExplanationProvider } from './types.js';

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

  async explain(input: ExplanationInput, signal: AbortSignal): Promise<unknown> {
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
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserMessage(input) }],
      }),
    });
    // Status only: never put the response body or the key in the error (it ends up in logs).
    if (!res.ok) throw new Error(`LLM request failed with status ${res.status}`);

    const body = (await res.json()) as { content?: { type?: string; text?: string }[] };
    const block = body.content?.find((c) => c.type === 'text');
    return block?.text ?? null;
  }
}
