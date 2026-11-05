import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../src/config/env.js';

const DATABASE_URL = 'postgres://u:p@127.0.0.1:5432/db';

describe('loadEnv', () => {
  it('applies safe defaults (loopback host, port 3000)', () => {
    expect(loadEnv({ DATABASE_URL })).toEqual({
      APP_ENV: 'demo',
      HOST: '127.0.0.1',
      PORT: 3000,
      DATABASE_URL,
      DEMO_STUDENT_ID: '55555555-5555-4555-8555-555555555555',
      AI_MODE: 'disabled',
      LLM_PROVIDER: 'anthropic',
      AI_MAX_CALLS_PER_MINUTE: 6,
      AI_MAX_CALLS_PER_DAY: 50,
      AI_TIMEOUT_MS: 8000,
    });
  });

  it('parses PORT from string', () => {
    expect(loadEnv({ DATABASE_URL, PORT: '4000' }).PORT).toBe(4000);
  });

  it('rejects invalid PORT', () => {
    expect(() => loadEnv({ DATABASE_URL, PORT: 'abc' })).toThrow(/Invalid environment/);
    expect(() => loadEnv({ DATABASE_URL, PORT: '70000' })).toThrow(/Invalid environment/);
  });

  it('rejects a non-UUID DEMO_STUDENT_ID', () => {
    expect(() => loadEnv({ DATABASE_URL, DEMO_STUDENT_ID: 'abc' })).toThrow(/DEMO_STUDENT_ID/);
  });

  it('validates AI settings; real mode needs a key and model', () => {
    expect(loadEnv({ DATABASE_URL, AI_MODE: 'mock' }).AI_MODE).toBe('mock');
    expect(() => loadEnv({ DATABASE_URL, AI_MODE: 'nope' })).toThrow(/AI_MODE/);
    expect(() => loadEnv({ DATABASE_URL, AI_MODE: 'real' })).toThrow(/LLM_API_KEY/);
    expect(() => loadEnv({ DATABASE_URL, AI_MODE: 'real', LLM_API_KEY: 'k' })).toThrow(/LLM_MODEL/);
    const env = loadEnv({ DATABASE_URL, AI_MODE: 'real', LLM_API_KEY: 'k', LLM_MODEL: 'm' });
    expect(env).toMatchObject({ LLM_API_KEY: 'k', LLM_MODEL: 'm' });
    expect(() => loadEnv({ DATABASE_URL, AI_TIMEOUT_MS: '5' })).toThrow(/AI_TIMEOUT_MS/);
    expect(loadEnv({ DATABASE_URL, AI_MAX_CALLS_PER_DAY: '10' }).AI_MAX_CALLS_PER_DAY).toBe(10);
    expect(() => loadEnv({ DATABASE_URL, AI_MAX_CALLS_PER_DAY: '0' })).toThrow(
      /AI_MAX_CALLS_PER_DAY/,
    );
    expect(() => loadEnv({ DATABASE_URL, AI_MAX_CALLS_PER_MINUTE: 'x' })).toThrow(
      /AI_MAX_CALLS_PER_MINUTE/,
    );
    expect(loadEnv({ DATABASE_URL, LLM_PROVIDER: 'openai' }).LLM_PROVIDER).toBe('openai');
    expect(() => loadEnv({ DATABASE_URL, LLM_PROVIDER: 'other' })).toThrow(/LLM_PROVIDER/);
  });

  it('requires a postgres DATABASE_URL', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL/);
    expect(() => loadEnv({ DATABASE_URL: 'mysql://x' })).toThrow(/DATABASE_URL/);
  });
});
