import { afterEach, describe, expect, it, vi } from "vitest";

const CLIENT = "00000000-0000-4000-8000-000000000001";

const boundary = vi.hoisted(() => ({
  enforce: vi.fn(),
  rankings: vi.fn(),
}));

vi.mock("@/lib/agents/authAgent", () => ({
  enforceClientAccess: boundary.enforce,
}));

vi.mock("@/lib/db/repository", () => ({
  listKeywordRankings: boundary.rankings,
}));

import { GET } from "./route";

function get(
  clientId: string,
  searchParams: Record<string, string> = {},
) {
  const qs = new URLSearchParams(searchParams).toString();
  const url = `http://localhost/api/metrics/${clientId}/keywords${qs ? `?${qs}` : ""}`;
  return GET(new Request(url, { method: "GET" }), {
    params: Promise.resolve({ clientId }),
  });
}

afterEach(() => {
  boundary.enforce.mockReset();
  boundary.rankings.mockReset();
});

describe("GET /api/metrics/[clientId]/keywords", () => {
  it("returns 401 for unauthenticated requests", async () => {
    boundary.enforce.mockResolvedValue({ allow: false, reason: "unauthenticated" });

    const response = await get(CLIENT);
    expect(response.status).toBe(401);
    expect(boundary.rankings).not.toHaveBeenCalled();
  });

  it("returns 403 for cross-tenant access", async () => {
    boundary.enforce.mockResolvedValue({ allow: false, reason: "forbidden" });

    const response = await get(CLIENT);
    expect(response.status).toBe(403);
  });

  it("returns 400 for a malformed client id", async () => {
    const response = await get("not-a-uuid");
    expect(response.status).toBe(400);
  });

  it("returns 400 for an invalid source", async () => {
    boundary.enforce.mockResolvedValue({ allow: true });

    const response = await get(CLIENT, { source: "gscx" });
    expect(response.status).toBe(400);
  });

  it("returns rank history with meta for an admin caller", async () => {
    boundary.enforce.mockResolvedValue({ allow: true });
    boundary.rankings.mockResolvedValue([
      { keyword: "alpha", rank: 3, syncedAt: "2026-09-16T00:00:00.000Z" },
    ]);

    const response = await get(CLIENT, { from: "2026-09-01T00:00:00.000Z" });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.data).toEqual([
      { keyword: "alpha", rank: 3, syncedAt: "2026-09-16T00:00:00.000Z" },
    ]);
    expect(body.meta).toMatchObject({
      clientId: CLIENT,
      source: "gsc",
      from: "2026-09-01T00:00:00.000Z",
      count: 1,
    });
    expect(boundary.rankings).toHaveBeenCalledWith(
      CLIENT,
      "gsc",
      "2026-09-01T00:00:00.000Z",
      expect.any(String),
    );
  });
});