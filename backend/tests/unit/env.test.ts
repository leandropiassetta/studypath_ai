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
    });
  });

  it('parses PORT from string', () => {
    expect(loadEnv({ DATABASE_URL, PORT: '4000' }).PORT).toBe(4000);
  });

  it('rejects invalid PORT', () => {
    expect(() => loadEnv({ DATABASE_URL, PORT: 'abc' })).toThrow(/Invalid environment/);
    expect(() => loadEnv({ DATABASE_URL, PORT: '70000' })).toThrow(/Invalid environment/);
  });

  it('requires a postgres DATABASE_URL', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL/);
    expect(() => loadEnv({ DATABASE_URL: 'mysql://x' })).toThrow(/DATABASE_URL/);
  });
});
