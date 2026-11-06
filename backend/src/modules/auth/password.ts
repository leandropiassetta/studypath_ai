import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

type Scrypt = (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;
const scrypt = promisify(scryptCallback) as unknown as Scrypt;

/** OWASP-recommended minimum for scrypt is N=2^17 with r=8; 2^15 is a pragmatic local default. */
export const DEFAULT_SCRYPT_COST = 32_768;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
export const MAX_PASSWORD_LENGTH = 128;

const normalize = (password: string): string => password.normalize('NFKC');
const memoryFor = (n: number): number => 128 * n * R * 2;

/** `scrypt$N$r$p$salt$hash` (base64): parameters travel with the hash so they can be raised later. */
export async function hashPassword(password: string, cost = DEFAULT_SCRYPT_COST): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await scrypt(normalize(password), salt, KEY_LENGTH, {
    N: cost,
    r: R,
    p: P,
    maxmem: memoryFor(cost),
  });
  return ['scrypt', cost, R, P, salt.toString('base64'), key.toString('base64')].join('$');
}

/** Constant-time comparison. Malformed stored values simply fail. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'scrypt' || !n || !r || !p || !saltB64 || !hashB64) return false;
  const cost = Number(n);
  if (!Number.isInteger(cost) || cost < 2 || Number(r) !== R || Number(p) !== P) return false;

  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scrypt(
    normalize(password),
    Buffer.from(saltB64, 'base64'),
    expected.length,
    {
      N: cost,
      r: R,
      p: P,
      maxmem: memoryFor(cost),
    },
  );
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
