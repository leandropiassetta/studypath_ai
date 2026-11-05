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

  it('requires a postgres DATABASE_URL', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL/);
    expect(() => loadEnv({ DATABASE_URL: 'mysql://x' })).toThrow(/DATABASE_URL/);
  });
});
