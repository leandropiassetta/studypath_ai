import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/modules/auth/password.js';
import { FailureLimiter } from '../../src/modules/auth/limiter.js';

const COST = 1024; // cheap, tests only

describe('password hashing (scrypt)', () => {
  it('verifies the right password and rejects a wrong one', async () => {
    const hash = await hashPassword('correct horse battery', COST);
    expect(await verifyPassword('correct horse battery', hash)).toBe(true);
    expect(await verifyPassword('correct horse batterz', hash)).toBe(false);
    expect(await verifyPassword('', hash)).toBe(false);
  });

  it('never stores the password and uses a fresh salt every time', async () => {
    const a = await hashPassword('same-password-123', COST);
    const b = await hashPassword('same-password-123', COST);
    expect(a).not.toContain('same-password-123');
    expect(a).not.toBe(b);
    expect(await verifyPassword('same-password-123', a)).toBe(true);
    expect(await verifyPassword('same-password-123', b)).toBe(true);
  });

  it('carries its parameters, so older hashes keep verifying after a cost change', async () => {
    const weak = await hashPassword('migrating-password', 1024);
    const strong = await hashPassword('migrating-password', 2048);
    expect(weak.split('$').slice(0, 4)).toEqual(['scrypt', '1024', '8', '1']);
    expect(strong.split('$')[1]).toBe('2048');
    expect(await verifyPassword('migrating-password', weak)).toBe(true);
    expect(await verifyPassword('migrating-password', strong)).toBe(true);
  });

  it('treats canonically equivalent unicode as the same password (NFKC)', async () => {
    const composed = 'sená-secreta-1'; // á as one code point
    const decomposed = 'sená-secreta-1'; // a + combining accent
    const hash = await hashPassword(composed, COST);
    expect(await verifyPassword(decomposed, hash)).toBe(true);
  });

  it('fails closed on malformed stored values', async () => {
    for (const bad of [
      '',
      'plaintext',
      'scrypt$x$8$1$AA$AA',
      'bcrypt$10$8$1$AA$AA',
      'scrypt$1024$9$1$AA$AA',
      'scrypt$1024$8$1$$',
    ]) {
      expect(await verifyPassword('whatever-password', bad)).toBe(false);
    }
  });
});

describe('FailureLimiter', () => {
  it('blocks after the maximum failures and reports a retry time', () => {
    let t = 0;
    const limiter = new FailureLimiter(3, 60_000, () => t);
    expect(limiter.retryAfterSeconds('k')).toBeNull();
    limiter.recordFailure('k');
    limiter.recordFailure('k');
    expect(limiter.retryAfterSeconds('k')).toBeNull();
    limiter.recordFailure('k');
    expect(limiter.retryAfterSeconds('k')).toBe(60);
    t = 45_000;
    expect(limiter.retryAfterSeconds('k')).toBe(15);
    t = 60_001;
    expect(limiter.retryAfterSeconds('k')).toBeNull(); // the window slid past the failures
  });

  it('keeps keys independent and resets on success', () => {
    const limiter = new FailureLimiter(1, 60_000, () => 0);
    limiter.recordFailure('a');
    expect(limiter.retryAfterSeconds('a')).not.toBeNull();
    expect(limiter.retryAfterSeconds('b')).toBeNull();
    limiter.reset('a');
    expect(limiter.retryAfterSeconds('a')).toBeNull();
  });

  it('bounds its memory when many different keys fail', () => {
    const limiter = new FailureLimiter(1, 60_000, () => 0, 3);
    for (const key of ['a', 'b', 'c', 'd']) limiter.recordFailure(key);
    expect(limiter.retryAfterSeconds('a')).toBeNull(); // oldest key was dropped
    expect(limiter.retryAfterSeconds('d')).not.toBeNull();
  });
});
