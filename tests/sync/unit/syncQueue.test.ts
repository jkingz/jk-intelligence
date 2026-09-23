import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("bullmq", () => ({
  Queue: class {
    on() {}
    async close() {}
  },
}));

import { redisConnection } from "@/lib/queue/syncQueue";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("redisConnection", () => {
  it("uses an explicit REDIS_URL when present", () => {
    vi.stubEnv("REDIS_URL", "redis://localhost:6379/2");

    expect(redisConnection()).toMatchObject({
      host: "localhost",
      port: 6379,
      db: 2,
    });
  });

  it("derives a rediss URL from Upstash REST credentials", () => {
    vi.stubEnv("REDIS_URL", "");
    vi.stubEnv(
      "UPSTASH_REDIS_REST_URL",
      "https://large-bluegill-283930.upstash.io",
    );
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "t0k3n/with-symbols");

    expect(redisConnection(true)).toMatchObject({
      host: "large-bluegill-283930.upstash.io",
      port: 6379,
      username: "default",
      password: "t0k3n/with-symbols",
      tls: {},
      maxRetriesPerRequest: null,
    });
  });

  it("throws without either Redis or Upstash credentials", () => {
    vi.stubEnv("REDIS_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");

    expect(() => redisConnection()).toThrow("REDIS_URL is required");
  });
});