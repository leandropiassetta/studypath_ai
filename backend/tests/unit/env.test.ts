import { readFileSync } from 'node:fs';
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

describe('.env.example', () => {
  const text = readFileSync(new URL('../../../.env.example', import.meta.url), 'utf8');
  /** Active settings only (commented ones are documentation). */
  const active = Object.fromEntries(
    text
      .split('\n')
      .map((l) => /^([A-Z0-9_]+)=(.*)$/.exec(l))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => [m[1] as string, m[2] as string]),
  );
  /** Every name the app reads, active or commented in the example. */
  const documented = new Set(
    [...text.matchAll(/^#?\s?([A-Z][A-Z0-9_]+)=/gm)].map((m) => m[1] as string),
  );

  it('is a valid configuration as it is, so copying it works without changes', () => {
    const env = loadEnv(active);
    expect(env.AI_MODE).toBe('disabled'); // safe default: no key needed
    expect(env.HOST).toBe('127.0.0.1');
  });

  it('documents every setting the API reads', () => {
    const all = [
      'APP_ENV',
      'HOST',
      'PORT',
      'DATABASE_URL',
      'REDIS_URL',
      'SLA_DELAY_MS',
      'AI_MODE',
      'AI_TIMEOUT_MS',
      'AI_MAX_CALLS_PER_MINUTE',
      'AI_MAX_CALLS_PER_DAY',
      'LLM_PROVIDER',
      'LLM_BASE_URL',
      'LLM_MODEL',
      'LLM_API_KEY',
      'SESSION_TTL_DAYS',
      'TEACHER_INVITE_CODE',
      'DEMO_EMAIL',
      'DEMO_PASSWORD',
      'TEACHER_EMAIL',
      'TEACHER_PASSWORD',
      'TEACHER_NAME',
      'DEMO_STUDENT_ID',
      'ALLOW_NON_LOOPBACK_HOST',
      'ALLOWED_ORIGINS',
      'TRUST_PROXY',
      'AI_MAX_CALLS_GLOBAL_PER_DAY',
    ];
    expect(all.filter((name) => !documented.has(name))).toEqual([]);
  });

  it('never carries a real secret: keys, passwords and the invite code stay empty or commented', () => {
    for (const name of [
      'LLM_API_KEY',
      'DEMO_PASSWORD',
      'TEACHER_PASSWORD',
      'TEACHER_INVITE_CODE',
    ]) {
      expect(active[name] ?? '', name).toBe('');
    }
    expect(text).not.toMatch(/gsk_[A-Za-z0-9]{10,}|sk-[A-Za-z0-9_-]{20,}/);
  });
});

describe('loadEnv: deployment settings', () => {
  it('have safe defaults: no extra origins, no proxy, no global cap', () => {
    const env = loadEnv({ DATABASE_URL });
    expect(env.ALLOWED_ORIGINS).toEqual([]);
    expect(env.TRUST_PROXY).toBe(0);
    expect(env.AI_MAX_CALLS_GLOBAL_PER_DAY).toBeUndefined();
  });

  it('parses a comma-separated origin list, trimming spaces and trailing slashes', () => {
    const env = loadEnv({
      DATABASE_URL,
      ALLOWED_ORIGINS: ' https://a.github.io , https://b.example.com:8443/ ,, ',
    });
    expect(env.ALLOWED_ORIGINS).toEqual(['https://a.github.io', 'https://b.example.com:8443']);
  });

  it('rejects wildcards, paths and other schemes in the origin list', () => {
    for (const bad of ['*', 'https://a.dev/app', 'ftp://a.dev', 'a.dev', 'https://*.a.dev']) {
      expect(() => loadEnv({ DATABASE_URL, ALLOWED_ORIGINS: bad }), bad).toThrow(/ALLOWED_ORIGINS/);
    }
  });

  it('validates the proxy hops and the global AI cap', () => {
    expect(loadEnv({ DATABASE_URL, TRUST_PROXY: '1' }).TRUST_PROXY).toBe(1);
    expect(() => loadEnv({ DATABASE_URL, TRUST_PROXY: '9' })).toThrow(/TRUST_PROXY/);
    expect(() => loadEnv({ DATABASE_URL, TRUST_PROXY: '-1' })).toThrow(/TRUST_PROXY/);
    expect(
      loadEnv({ DATABASE_URL, AI_MAX_CALLS_GLOBAL_PER_DAY: '300' }).AI_MAX_CALLS_GLOBAL_PER_DAY,
    ).toBe(300);
    expect(() => loadEnv({ DATABASE_URL, AI_MAX_CALLS_GLOBAL_PER_DAY: '0' })).toThrow(/GLOBAL/);
  });
});
