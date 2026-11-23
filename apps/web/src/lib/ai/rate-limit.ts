/**
 * Allows each key at most `limit` requests within a sliding window. Kept in
 * memory per server instance, which is enough to protect the API key of a
 * single-instance demo from one user's bursts.
 */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Records a request and reports whether it is within the limit. */
  take(key: string): boolean {
    const now = this.now();
    const recent = (this.hits.get(key) ?? []).filter(
      (time) => now - time < this.windowMs,
    );
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }
}
