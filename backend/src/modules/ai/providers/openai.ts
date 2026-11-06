import {
  buildHintMessage,
  buildUserMessage,
  HINT_SYSTEM_PROMPT,
  SYSTEM_PROMPT,
} from '../prompt.js';
import type { ExplanationInput, ExplanationProvider, HintInput } from './types.js';

export interface OpenAIOptions {
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

/** Calls the OpenAI Chat Completions API over plain fetch (no SDK dependency). */
export class OpenAIExplanationProvider implements ExplanationProvider {
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;

  constructor(private readonly options: OpenAIOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.baseUrl = options.baseUrl ?? 'https://api.openai.com';
  }

  explain(input: ExplanationInput, signal: AbortSignal): Promise<unknown> {
    return this.chat(SYSTEM_PROMPT, buildUserMessage(input), 800, signal);
  }

  hint(input: HintInput, signal: AbortSignal): Promise<unknown> {
    return this.chat(HINT_SYSTEM_PROMPT, buildHintMessage(input), 500, signal);
  }

  private async chat(
    system: string,
    user: string,
    maxTokens: number,
    signal: AbortSignal,
  ): Promise<unknown> {
    const res = await this.fetchImpl(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      signal,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.options.apiKey}`,
      },
      body: JSON.stringify({
        model: this.options.model,
        max_completion_tokens: maxTokens,
        // JSON mode: the system prompt asks for a JSON object; output is still validated.
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    // Status only: never put the response body or the key in the error (it ends up in logs).
    if (!res.ok) throw new Error(`LLM request failed with status ${res.status}`);

    const body = (await res.json()) as { choices?: { message?: { content?: string | null } }[] };
    return body.choices?.[0]?.message?.content ?? null;
  }
}
