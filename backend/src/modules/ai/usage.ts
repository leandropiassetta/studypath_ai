/** In-memory cost guards for the LLM endpoint. State resets on restart (fine for local demo). */

export interface UsageLimits {
  perMinute: number;
  perDay: number;
  /**
   * Optional cap on ALL students together per 24 h. A public deployment shares one provider key
   * (and its free quota) among everyone, so a flood of new accounts must not be able to use it up.
   */
  globalPerDay?: number;
}

export const DEFAULT_USAGE_LIMITS: UsageLimits = { perMinute: 6, perDay: 50 };

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * 60_000;

export type LimitVerdict = 'ok' | 'minute' | 'day';

/** Sliding-window counter per key (a student). Only calls that really reach the LLM count. */
const GLOBAL_KEY = '\u0000global';

export class UsageLimiter {
  private readonly calls = new Map<string, number[]>();

  constructor(
    private readonly limits: UsageLimits,
    private readonly now: () => number = Date.now,
  ) {}

  /** Records a call when allowed. Refused calls are not recorded. */
  tryAcquire(key: string): LimitVerdict {
    const t = this.now();
    const recent = (this.calls.get(key) ?? []).filter((at) => t - at < DAY_MS);

    if (recent.length >= this.limits.perDay) {
      this.calls.set(key, recent);
      return 'day';
    }
    if (recent.filter((at) => t - at < MINUTE_MS).length >= this.limits.perMinute) {
      this.calls.set(key, recent);
      return 'minute';
    }
    const { globalPerDay } = this.limits;
    if (globalPerDay !== undefined) {
      const all = (this.calls.get(GLOBAL_KEY) ?? []).filter((at) => t - at < DAY_MS);
      if (all.length >= globalPerDay) {
        this.calls.set(GLOBAL_KEY, all);
        this.calls.set(key, recent);
        return 'day'; // refused: nothing is recorded for the student either
      }
      all.push(t);
      this.calls.set(GLOBAL_KEY, all);
    }
    recent.push(t);
    this.calls.set(key, recent);
    return 'ok';
  }
}

/** Small TTL cache so repeated clicks on the same question do not pay twice. Never persisted. */
export class ExplanationCache {
  private readonly entries = new Map<string, { value: string; expiresAt: number }>();

  constructor(
    private readonly maxEntries = 500,
    private readonly ttlMs = DAY_MS,
    private readonly now: () => number = Date.now,
  ) {}

  get(key: string): string | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: string): void {
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value as string;
      this.entries.delete(oldest);
    }
  }
}
