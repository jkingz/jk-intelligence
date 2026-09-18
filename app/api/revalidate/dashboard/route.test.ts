import { afterEach, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({
  revalidate: vi.fn(),
}));

vi.mock("@/lib/cache/invalidate", () => ({
  revalidateDashboardOverview: boundary.revalidate,
}));

import { POST } from "./route";

function post(headers: Record<string, string> = {}) {
  return POST(new Request("http://localhost/api/revalidate/dashboard", { method: "POST", headers }));
}

afterEach(() => {
  boundary.revalidate.mockReset();
  vi.unstubAllEnvs();
});

describe("POST /api/revalidate/dashboard", () => {
  it("revalidates with a valid cron secret", async () => {
    vi.stubEnv("CRON_SECRET", "test-only-secret");

    const response = await post({ authorization: "Bearer test-only-secret" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ revalidated: true, tag: "dashboard-overview" });
    expect(boundary.revalidate).toHaveBeenCalledTimes(1);
  });

  it("rejects a wrong secret without revalidating", async () => {
    vi.stubEnv("CRON_SECRET", "test-only-secret");

    const response = await post({ authorization: "Bearer nope" });
    expect(response.status).toBe(401);
    expect(boundary.revalidate).not.toHaveBeenCalled();
  });

  it("reports unavailable without a configured secret", async () => {
    const response = await post({ authorization: "Bearer whatever" });
    expect(response.status).toBe(503);
    expect(boundary.revalidate).not.toHaveBeenCalled();
  });
});