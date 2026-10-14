import { afterEach, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({
  listActiveClients: vi.fn(),
  enqueueSync: vi.fn(),
}));

vi.mock("@/lib/db/repository", () => ({
  listActiveClients: boundary.listActiveClients,
}));

vi.mock("@/lib/queue/syncQueue", () => ({
  enqueueSync: boundary.enqueueSync,
}));

import { GET } from "@/app/api/cron/sync/route";

function get(headers: Record<string, string> = {}) {
  return GET(new Request("http://localhost/api/cron/sync", { headers }));
}

afterEach(() => {
  boundary.listActiveClients.mockReset();
  boundary.enqueueSync.mockReset();
  vi.unstubAllEnvs();
});

describe("GET /api/cron/sync", () => {
  it("returns 503 when CRON_SECRET is not configured, and enqueues nothing", async () => {
    vi.stubEnv("CRON_SECRET", "");

    const response = await get({ authorization: "Bearer anything" });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Cron unavailable" });
    expect(boundary.listActiveClients).not.toHaveBeenCalled();
    expect(boundary.enqueueSync).not.toHaveBeenCalled();
  });

  it("returns 401 without the bearer secret, before reading any client", async () => {
    vi.stubEnv("CRON_SECRET", "test-only-secret");

    const response = await get({ authorization: "Bearer wrong" });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(boundary.listActiveClients).not.toHaveBeenCalled();
    expect(boundary.enqueueSync).not.toHaveBeenCalled();
  });

  it("returns 503 when the active-client read fails, and enqueues nothing", async () => {
    vi.stubEnv("CRON_SECRET", "test-only-secret");
    boundary.listActiveClients.mockRejectedValue(new Error("connection reset"));

    const response = await get({ authorization: "Bearer test-only-secret" });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Unable to read active clients" });
    expect(boundary.enqueueSync).not.toHaveBeenCalled();
  });

  it("queues one sync job per active client with a shared run id", async () => {
    vi.stubEnv("CRON_SECRET", "test-only-secret");
    boundary.listActiveClients.mockResolvedValue([{ id: "client-a" }, { id: "client-b" }]);
    boundary.enqueueSync.mockResolvedValueOnce("job-a").mockResolvedValueOnce("job-b");

    const response = await get({ authorization: "Bearer test-only-secret" });
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ queued: 2, errors: [] });
    expect(boundary.enqueueSync).toHaveBeenCalledTimes(2);
    const [first, second] = boundary.enqueueSync.mock.calls.map((call) => call[0]);
    expect(first).toEqual({ clientId: "client-a", runId: expect.any(String) });
    expect(second).toEqual({ clientId: "client-b", runId: first.runId });
  });

  it("reports a failed enqueue per client without failing the others", async () => {
    vi.stubEnv("CRON_SECRET", "test-only-secret");
    boundary.listActiveClients.mockResolvedValue([{ id: "client-a" }, { id: "client-b" }]);
    boundary.enqueueSync
      .mockRejectedValueOnce(new Error("redis down"))
      .mockResolvedValueOnce("job-b");

    const response = await get({ authorization: "Bearer test-only-secret" });
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({
      queued: 1,
      errors: [{ clientId: "client-a", message: "redis down" }],
    });
  });
});
