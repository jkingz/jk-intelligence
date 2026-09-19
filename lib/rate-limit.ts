export interface RateLimitOptions {
  max: number;
  windowMs: number;
}

export class SlidingWindowLimiter {
  private timestamps: number[] = [];

  constructor(private readonly options: RateLimitOptions) {}

  trySubmit(now = Date.now()): boolean {
    this.prune(now);
    if (this.timestamps.length >= this.options.max) return false;
    this.timestamps.push(now);
    return true;
  }

  retryAfter(now = Date.now()): number {
    this.prune(now);
    if (this.timestamps.length === 0) return 0;
    const oldest = this.timestamps[0]!;
    return Math.max(0, this.options.windowMs - (now - oldest));
  }

  reset(): void {
    this.timestamps = [];
  }

  private prune(now: number): void {
    const cutoff = now - this.options.windowMs;
    this.timestamps = this.timestamps.filter((timestamp) => timestamp > cutoff);
  }
}