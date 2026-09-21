import { afterEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({ incr: vi.fn(), expire: vi.fn() }));

vi.mock("@upstash/redis", () => ({
  Redis: class FakeRedis {
    incr = fake.incr;
    expire = fake.expire;
  },
}));

const URL = "https://example.upstash.io";
const TOKEN = "token";

async function loadQuota(configured: boolean) {
  vi.resetModules();
  vi.stubEnv("UPSTASH_REDIS_REST_URL", configured ? URL : undefined);
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", configured ? TOKEN : undefined);
  return import("./quota");
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("consumeExportQuota with a shared counter", () => {
  it("allows six exports per window and reports the wait for the seventh", async () => {
    const { consumeExportQuota, EXPORT_QUOTA } = await loadQuota(true);
    let count = 0;
    fake.incr.mockImplementation(async () => ++count);
    fake.expire.mockResolvedValue(1);

    for (let i = 0; i < EXPORT_QUOTA.max; i += 1) {
      await expect(consumeExportQuota("u1")).resolves.toEqual({ allowed: true });
    }
    const decision = await consumeExportQuota("u1");
    expect(decision).toMatchObject({ allowed: false });
    expect(decision.allowed ? 0 : decision.retryAfterSeconds).toBeGreaterThan(0);
    expect(fake.incr).toHaveBeenCalledTimes(EXPORT_QUOTA.max + 1);
    // The TTL is written once per window so sustained traffic cannot slide it.
    expect(fake.expire).toHaveBeenCalledTimes(1);
  });

  it("counts each user separately", async () => {
    const { consumeExportQuota } = await loadQuota(true);
    fake.incr.mockResolvedValue(7);
    fake.expire.mockResolvedValue(1);

    await expect(consumeExportQuota("u1")).resolves.toMatchObject({ allowed: false });
    const keys = fake.incr.mock.calls.map(([key]) => key);
    expect(new Set(keys).size).toBe(1);
    expect(String(keys[0])).toContain("u1");
  });

  it("falls back to the per-instance limiter when Redis fails", async () => {
    const { consumeExportQuota, EXPORT_QUOTA } = await loadQuota(true);
    fake.incr.mockRejectedValue(new Error("redis down"));

    for (let i = 0; i < EXPORT_QUOTA.max; i += 1) {
      await expect(consumeExportQuota("u2")).resolves.toEqual({ allowed: true });
    }
    await expect(consumeExportQuota("u2")).resolves.toMatchObject({ allowed: false });
  });
});

describe("consumeExportQuota without Redis", () => {
  it("still enforces the budget in-process", async () => {
    const { consumeExportQuota, EXPORT_QUOTA } = await loadQuota(false);

    for (let i = 0; i < EXPORT_QUOTA.max; i += 1) {
      await expect(consumeExportQuota("u3")).resolves.toEqual({ allowed: true });
    }
    await expect(consumeExportQuota("u3")).resolves.toMatchObject({ allowed: false });
    expect(fake.incr).not.toHaveBeenCalled();
  });
});
