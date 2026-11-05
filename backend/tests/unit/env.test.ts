import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../src/config/env.js';

describe('loadEnv', () => {
  it('applies safe defaults (loopback host, port 3000)', () => {
    expect(loadEnv({})).toEqual({ APP_ENV: 'demo', HOST: '127.0.0.1', PORT: 3000 });
  });

  it('parses PORT from string', () => {
    expect(loadEnv({ PORT: '4000' }).PORT).toBe(4000);
  });

  it('rejects invalid PORT', () => {
    expect(() => loadEnv({ PORT: 'abc' })).toThrow(/Invalid environment/);
    expect(() => loadEnv({ PORT: '70000' })).toThrow(/Invalid environment/);
  });
});
