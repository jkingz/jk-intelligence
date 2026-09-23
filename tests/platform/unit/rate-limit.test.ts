import { describe, expect, it } from "vitest";
import { SlidingWindowLimiter } from "@/lib/rate-limit";

describe("SlidingWindowLimiter", () => {
  it("allows submissions up to the window cap", () => {
    const limiter = new SlidingWindowLimiter({ max: 3, windowMs: 60_000 });
    expect(limiter.trySubmit(0)).toBe(true);
    expect(limiter.trySubmit(1)).toBe(true);
    expect(limiter.trySubmit(2)).toBe(true);
    expect(limiter.trySubmit(3)).toBe(false);
  });

  it("frees a slot once the oldest submission leaves the window", () => {
    const limiter = new SlidingWindowLimiter({ max: 1, windowMs: 1_000 });
    expect(limiter.trySubmit(0)).toBe(true);
    expect(limiter.trySubmit(500)).toBe(false);
    expect(limiter.trySubmit(1_001)).toBe(true);
  });

  it("reports retry-after time until the oldest submission expires", () => {
    const limiter = new SlidingWindowLimiter({ max: 1, windowMs: 1_000 });
    expect(limiter.trySubmit(0)).toBe(true);
    expect(limiter.retryAfter(500)).toBe(500);
    expect(limiter.retryAfter(1_001)).toBe(0);
  });

  it("reset clears recorded submissions", () => {
    const limiter = new SlidingWindowLimiter({ max: 1, windowMs: 60_000 });
    expect(limiter.trySubmit(0)).toBe(true);
    limiter.reset();
    expect(limiter.trySubmit(1)).toBe(true);
  });
});