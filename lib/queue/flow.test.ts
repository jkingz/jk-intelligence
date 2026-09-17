import { afterEach, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({
  jobs: [] as Array<{
    id: string;
    name: string;
    data: { clientId: string; runId: string };
  }>,
  processor: undefined as
    | undefined
    | ((job: { data: unknown }) => Promise<unknown>),
}));

vi.mock("bullmq", () => ({
  Queue: class {
    on() {}
    async add(
      name: string,
      data: { clientId: string; runId: string },
      options: { jobId: string },
    ) {
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

import { POST } from "@/app/api/cron/sync/route";
import { closeSyncQueue } from "./syncQueue";

vi.stubEnv("REDIS_URL", "redis://localhost:6379");
await import("./worker");

const processor = boundary.processor;
if (!processor) throw new Error("Worker did not register a processor");

 afterEach(async () => {
  boundary.jobs.length = 0;
  await closeSyncQueue();
  vi.unstubAllEnvs();
});

describe("cron → mocked BullMQ queue → worker", () => {
  it("enqueues an authorized cron request and processes its exact job", async () => {
    vi.stubEnv("CRON_SECRET", "test-only-secret");
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");
    const response = await POST(
      new Request("http://localhost/api/cron/sync", {
        method: "POST",
        headers: { authorization: "Bearer test-only-secret" },
      }),
    );

    expect(response.status).toBe(202);
    expect(boundary.jobs).toHaveLength(1);
    const job = boundary.jobs.shift()!;
    expect(await response.json()).toEqual({ jobs: [job.id] });
    expect(job.name).toBe("sync-client");
    expect(await processor(job)).toEqual({
      clientId: job.data.clientId,
      status: "mock_completed",
    });
  });

  it("rejects unauthorized requests without enqueueing", async () => {
    vi.stubEnv("CRON_SECRET", "test-only-secret");
    const response = await POST(
      new Request("http://localhost/api/cron/sync", { method: "POST" }),
    );
    expect(response.status).toBe(401);
    expect(boundary.jobs).toHaveLength(0);
  });

  it("rejects malformed queued jobs at the worker boundary", async () => {
    await expect(processor({ data: { clientId: "invalid" } })).rejects.toThrow();
  });
});
