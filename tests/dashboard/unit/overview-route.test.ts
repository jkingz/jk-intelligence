import { afterEach, describe, expect, it, vi } from "vitest";

const CLIENT = "00000000-0000-4000-8000-000000000001";
const USER = { id: "00000000-0000-4000-8000-00000000000c", role: "client", clientId: CLIENT };

const boundary = vi.hoisted(() => ({
  user: vi.fn(),
  clients: vi.fn(),
  overview: vi.fn(),
  history: vi.fn(),
}));

vi.mock("@/lib/agents/authAgent", () => ({
  getAuthUser: boundary.user,
}));

vi.mock("@/lib/db/repository", () => ({
  getCachedDashboardOverview: boundary.overview,
  getCachedKeywordHistory: boundary.history,
  listAccessibleClients: boundary.clients,
}));

import { GET } from "@/app/api/metrics/[clientId]/overview/route";

function get(clientId: string, searchParams: Record<string, string> = {}) {
  const qs = new URLSearchParams(searchParams).toString();
  const url = `http://localhost/api/metrics/${clientId}/overview${qs ? `?${qs}` : ""}`;
  return GET(new Request(url, { method: "GET" }), {
    params: Promise.resolve({ clientId }),
  });
}

afterEach(() => {
  boundary.user.mockReset();
  boundary.clients.mockReset();
  boundary.overview.mockReset();
  boundary.history.mockReset();
});

describe("GET /api/metrics/[clientId]/overview", () => {
  it("returns 401 without a session and never reaches the tenant gate", async () => {
    boundary.user.mockResolvedValue(null);

    const response = await get(CLIENT);
    expect(response.status).toBe(401);
    expect(boundary.clients).not.toHaveBeenCalled();
    expect(boundary.overview).not.toHaveBeenCalled();
  });

  it("returns 403 for a forged client id outside the RLS-visible set", async () => {
    const FOREIGN = "00000000-0000-4000-8000-00000000000b";
    boundary.user.mockResolvedValue(USER);
    boundary.clients.mockResolvedValue([]);

    const response = await get(FOREIGN);
    expect(response.status).toBe(403);
    expect(boundary.overview).not.toHaveBeenCalled();
    expect(boundary.history).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed client id before any auth read", async () => {
    const response = await get("not-a-uuid");
    expect(response.status).toBe(400);
    expect(boundary.user).not.toHaveBeenCalled();
  });

  it("falls back to the default range for an unsupported days value", async () => {
    boundary.user.mockResolvedValue(USER);
    boundary.clients.mockResolvedValue([
      { id: CLIENT, name: "Atlas Coffee", domain: "atlas.example", initials: "AC" },
    ]);
    boundary.overview.mockResolvedValue({ ok: true });
    boundary.history.mockResolvedValue([]);

    const response = await get(CLIENT, { days: "365" });
    expect(response.status).toBe(200);
    expect(boundary.overview).toHaveBeenCalledWith(expect.objectContaining({ id: CLIENT }), 7);
  });

  it("serves the overview and keyword history for an accessible client", async () => {
    const client = { id: CLIENT, name: "Atlas Coffee", domain: "atlas.example", initials: "AC" };
    boundary.user.mockResolvedValue(USER);
    boundary.clients.mockResolvedValue([client]);
    boundary.overview.mockResolvedValue({ clicks: 10 });
    boundary.history.mockResolvedValue([{ keyword: "coffee", rank: 2 }]);

    const response = await get(CLIENT, { days: "30" });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      overview: { clicks: 10 },
      history: [{ keyword: "coffee", rank: 2 }],
    });
    expect(boundary.overview).toHaveBeenCalledWith(client, 30);
    // Invariant: CDN s-maxage == CACHE_TTL_MS == unstable_cache revalidate (300s).
    expect(response.headers.get("Cache-Control")).toBe(
      "public, s-maxage=300, stale-while-revalidate=60",
    );
  });

  it("degrades to 503 with no-store when the read fails", async () => {
    boundary.user.mockResolvedValue(USER);
    boundary.clients.mockResolvedValue([
      { id: CLIENT, name: "Atlas Coffee", domain: "atlas.example", initials: "AC" },
    ]);
    boundary.overview.mockRejectedValue(new Error("boom"));

    const response = await get(CLIENT);
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("degrades to 503 with no-store when the tenant gate itself rejects", async () => {
    boundary.user.mockResolvedValue(USER);
    boundary.clients.mockRejectedValue(new Error("Database operation failed"));

    const response = await get(CLIENT);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Database operation failed",
    });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(boundary.overview).not.toHaveBeenCalled();
    expect(boundary.history).not.toHaveBeenCalled();
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
    expect(boundary.clients).not.toHaveBeenCalled();
    expect(boundary.overview).not.toHaveBeenCalled();
  });
});
