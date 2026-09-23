import { afterEach, describe, expect, it, vi } from "vitest";

const CLIENT_A = "00000000-0000-4000-8000-000000000001";
const CLIENT_B = "00000000-0000-4000-8000-000000000002";

const boundary = vi.hoisted(() => ({
  jobs: [] as Array<{
    id: string;
    name: string;
    data: { clientId: string; runId: string };
  }>,
  processor: undefined as
    | undefined
    | ((job: { data: unknown }) => Promise<unknown>),
  activeClients: [
    {
      id: "00000000-0000-4000-8000-000000000001",
      name: "Northstar Studio",
      domain: "northstar.example",
      is_active: true,
    },
    {
      id: "00000000-0000-4000-8000-000000000002",
      name: "Evergreen Goods",
      domain: "evergreen.example",
      is_active: true,
    },
  ],
  failClientId: null as string | null,
}));

vi.mock("bullmq", () => ({
  Queue: class {
    on() {}
    async add(
      name: string,
      data: { clientId: string; runId: string },
      options: { jobId: string },
    ) {
      if (data.clientId === boundary.failClientId) {
        throw new Error("redis unavailable");
      }
      const job = { id: options.jobId, name, data };
      boundary.jobs.push(job);
      return job;
    }
    async close() {}
  },
  Worker: class {
    constructor(
      _name: string,
      processor: (job: { data: unknown }) => Promise<unknown>,
    ) {
      boundary.processor = processor;
    }
    on() {}
    async close() {}
  },
}));

vi.mock("@/lib/db/repository", () => ({
  listActiveClients: vi.fn(async () => boundary.activeClients),
}));

import { GET } from "@/app/api/cron/sync/route";
import { closeSyncQueue } from "@/lib/queue/syncQueue";

vi.stubEnv("REDIS_URL", "redis://localhost:6379");
await import("@/lib/queue/worker");

const processor = boundary.processor;
if (!processor) throw new Error("Worker did not register a processor");

afterEach(async () => {
  boundary.jobs.length = 0;
  boundary.failClientId = null;
  await closeSyncQueue();
  vi.unstubAllEnvs();
});

describe("cron → mocked BullMQ queue → worker", () => {
  it("enqueues one job per active client and processes each job", async () => {
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");
    vi.stubEnv("CRON_SECRET", "test-only-secret");
    const response = await GET(
      new Request("http://localhost/api/cron/sync", {
        method: "GET",
        headers: { authorization: "Bearer test-only-secret" },
      }),
    );

    expect(response.status).toBe(202);
    expect(boundary.jobs).toHaveLength(2);
    expect(await response.json()).toEqual({ queued: 2, errors: [] });

    const clientIds = boundary.jobs.map((job) => job.data.clientId);
    expect(clientIds).toEqual([CLIENT_A, CLIENT_B]);

    for (const job of boundary.jobs.splice(0)) {
      expect(job.name).toBe("sync-client");
      expect(await processor(job)).toEqual({
        clientId: job.data.clientId,
        status: "mock_completed",
      });
    }
  });

  it("reports partial enqueue failures without failing the whole run", async () => {
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");
    vi.stubEnv("CRON_SECRET", "test-only-secret");
    boundary.failClientId = CLIENT_B;

    const response = await GET(
      new Request("http://localhost/api/cron/sync", {
        method: "GET",
        headers: { authorization: "Bearer test-only-secret" },
      }),
    );

    expect(await response.json()).toEqual({
      queued: 1,
      errors: [{ clientId: CLIENT_B, message: "redis unavailable" }],
    });
    expect(boundary.jobs.map((job) => job.data.clientId)).toEqual([CLIENT_A]);
  });

  it("rejects unauthorized requests without enqueueing", async () => {
    vi.stubEnv("CRON_SECRET", "test-only-secret");
    const response = await GET(
      new Request("http://localhost/api/cron/sync", { method: "GET" }),
    );
    expect(response.status).toBe(401);
    expect(boundary.jobs).toHaveLength(0);
  });

  it("rejects malformed queued jobs at the worker boundary", async () => {
    await expect(processor({ data: { clientId: "invalid" } })).rejects.toThrow();
  });
});