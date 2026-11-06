/**
 * Sliding-window failure counter, in memory (resets on restart; fine for a single local process).
 * Used to slow down password guessing and mass sign-ups.
 */
export class FailureLimiter {
  private readonly failures = new Map<string, number[]>();

  constructor(
    private readonly maxFailures: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
    private readonly maxKeys = 10_000,
  ) {}

  /** Seconds until another attempt is allowed, or null when the key is not blocked. */
  retryAfterSeconds(key: string): number | null {
    const recent = this.prune(key);
    if (recent.length < this.maxFailures) return null;
    const oldest = recent[0] as number;
    return Math.max(1, Math.ceil((oldest + this.windowMs - this.now()) / 1000));
  }

  recordFailure(key: string): void {
    const recent = this.prune(key);
    recent.push(this.now());
    this.failures.set(key, recent);
    while (this.failures.size > this.maxKeys) {
      this.failures.delete(this.failures.keys().next().value as string);
    }
  }

  reset(key: string): void {
    this.failures.delete(key);
  }

  private prune(key: string): number[] {
    const t = this.now();
    const recent = (this.failures.get(key) ?? []).filter((at) => t - at < this.windowMs);
    if (recent.length === 0) this.failures.delete(key);
    return recent;
  }
}
