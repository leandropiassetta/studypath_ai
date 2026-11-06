import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../src/config/env.js';

const DATABASE_URL = 'postgres://u:p@127.0.0.1:5432/db';

describe('loadEnv', () => {
  it('applies safe defaults (loopback host, port 3000)', () => {
    expect(loadEnv({ DATABASE_URL })).toMatchObject({
      APP_ENV: 'demo',
      HOST: '127.0.0.1',
      PORT: 3000,
      DATABASE_URL,
      DEMO_STUDENT_ID: '55555555-5555-4555-8555-555555555555',
      AI_MODE: 'disabled',
      LLM_PROVIDER: 'anthropic',
      SESSION_TTL_DAYS: 7,
      AI_MAX_CALLS_PER_MINUTE: 6,
      AI_MAX_CALLS_PER_DAY: 50,
      AI_TIMEOUT_MS: 8000,
      SLA_DELAY_MS: 14 * 60_000,
    });
  });

  it('keeps background jobs off without REDIS_URL and validates the new settings', () => {
    expect(loadEnv({ DATABASE_URL }).REDIS_URL).toBeUndefined();
    expect(loadEnv({ DATABASE_URL, REDIS_URL: 'redis://127.0.0.1:6379' }).REDIS_URL).toMatch(
      /^redis:/,
    );
    expect(() => loadEnv({ DATABASE_URL, REDIS_URL: 'http://x' })).toThrow(/REDIS_URL/);
    expect(
      loadEnv({ DATABASE_URL, LLM_BASE_URL: 'https://api.groq.com/openai' }).LLM_BASE_URL,
    ).toBe('https://api.groq.com/openai');
    expect(() => loadEnv({ DATABASE_URL, LLM_BASE_URL: 'ftp://x' })).toThrow(/LLM_BASE_URL/);
    expect(() => loadEnv({ DATABASE_URL, SLA_DELAY_MS: '5' })).toThrow(/SLA_DELAY_MS/);
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

  it('refuses a non-loopback HOST unless explicitly allowed (demo API has no auth)', () => {
    for (const host of ['127.0.0.1', '127.0.0.5', 'localhost', '::1']) {
      expect(loadEnv({ DATABASE_URL, HOST: host }).HOST).toBe(host);
    }
    for (const host of ['0.0.0.0', '192.168.0.10', '10.0.0.4', 'example.com']) {
      expect(() => loadEnv({ DATABASE_URL, HOST: host })).toThrow(/loopback/);
    }
    expect(loadEnv({ DATABASE_URL, HOST: '0.0.0.0', ALLOW_NON_LOOPBACK_HOST: 'true' }).HOST).toBe(
      '0.0.0.0',
    );
    expect(() =>
      loadEnv({ DATABASE_URL, HOST: '0.0.0.0', ALLOW_NON_LOOPBACK_HOST: 'yes' }),
    ).toThrow(/loopback/);
  });

  it('validates the session lifetime', () => {
    expect(loadEnv({ DATABASE_URL, SESSION_TTL_DAYS: '30' }).SESSION_TTL_DAYS).toBe(30);
    expect(() => loadEnv({ DATABASE_URL, SESSION_TTL_DAYS: '0' })).toThrow(/SESSION_TTL_DAYS/);
    expect(() => loadEnv({ DATABASE_URL, SESSION_TTL_DAYS: '365' })).toThrow(/SESSION_TTL_DAYS/);
  });

  it('requires a postgres DATABASE_URL', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL/);
    expect(() => loadEnv({ DATABASE_URL: 'mysql://x' })).toThrow(/DATABASE_URL/);
  });
});

describe('loadEnv: teacher invite code', () => {
  it('is optional, and when set it must be at least 8 characters', () => {
    expect(loadEnv({ DATABASE_URL }).TEACHER_INVITE_CODE).toBeUndefined();
    expect(loadEnv({ DATABASE_URL, TEACHER_INVITE_CODE: '' }).TEACHER_INVITE_CODE).toBeUndefined();
    expect(loadEnv({ DATABASE_URL, TEACHER_INVITE_CODE: 'um-codigo-ok' }).TEACHER_INVITE_CODE).toBe(
      'um-codigo-ok',
    );
    expect(() => loadEnv({ DATABASE_URL, TEACHER_INVITE_CODE: 'curto' })).toThrow(
      /TEACHER_INVITE_CODE/,
    );
  });
});
