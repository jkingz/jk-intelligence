import { afterEach, describe, expect, it, vi } from "vitest";

const CLIENT = "00000000-0000-4000-8000-000000000001";
const OWN_CLIENT = "00000000-0000-4000-8000-00000000000b";
const USER = { id: "00000000-0000-4000-8000-00000000000c", role: "client", clientId: OWN_CLIENT };

const boundary = vi.hoisted(() => ({
  user: vi.fn(),
  canAccess: vi.fn(),
  rankings: vi.fn(),
}));

vi.mock("@/lib/agents/authAgent", () => ({
  getAuthUser: boundary.user,
}));

vi.mock("@/lib/db/repository", () => ({
  canAccessClient: boundary.canAccess,
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
  boundary.user.mockReset();
  boundary.canAccess.mockReset();
  boundary.rankings.mockReset();
});

describe("GET /api/metrics/[clientId]/keywords", () => {
  it("returns 401 without probing the tenant gate when there is no session", async () => {
    boundary.user.mockResolvedValue(null);

    const response = await get(CLIENT);
    expect(response.status).toBe(401);
    expect(boundary.canAccess).not.toHaveBeenCalled();
    expect(boundary.rankings).not.toHaveBeenCalled();
  });

  it("returns 403 for a forged client id and never reads rankings", async () => {
    boundary.user.mockResolvedValue(USER);
    boundary.canAccess.mockResolvedValue(false);

    const response = await get(CLIENT);
    expect(response.status).toBe(403);
    expect(boundary.canAccess).toHaveBeenCalledWith(CLIENT);
    expect(boundary.rankings).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed client id", async () => {
    const response = await get("not-a-uuid");
    expect(response.status).toBe(400);
  });

  it("returns 400 for an invalid source", async () => {
    boundary.user.mockResolvedValue(USER);
    boundary.canAccess.mockResolvedValue(true);

    const response = await get(CLIENT, { source: "gscx" });
    expect(response.status).toBe(400);
  });

  it("returns rank history with meta once the gate allows the client", async () => {
    boundary.user.mockResolvedValue(USER);
    boundary.canAccess.mockResolvedValue(true);
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

  it("degrades to 503 with no-store when the tenant gate itself rejects", async () => {
    boundary.user.mockResolvedValue(USER);
    boundary.canAccess.mockRejectedValue(new Error("Database operation failed"));

    const response = await get(CLIENT);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Database operation failed",
    });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(boundary.rankings).not.toHaveBeenCalled();
  });

  it("degrades to 503 when the identity read itself rejects", async () => {
    boundary.user.mockRejectedValue(
      new Error("Supabase client configuration unavailable"),
    );

    const response = await get(CLIENT);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Database operation failed",
    });
    expect(boundary.canAccess).not.toHaveBeenCalled();
    expect(boundary.rankings).not.toHaveBeenCalled();
  });
});
