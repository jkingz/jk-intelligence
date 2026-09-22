import { afterEach, describe, expect, it, vi } from "vitest";

const CLIENT_A = "00000000-0000-4000-8000-000000000001";
const CLIENT_B = "00000000-0000-4000-8000-000000000002";

const CLIENTS = [
  { id: CLIENT_A, name: "Northstar", domain: "northstar.test", initials: "NS" },
  { id: CLIENT_B, name: "Lumen", domain: "lumen.test", initials: "LU" },
];

const OVERVIEW = { clicks: 12 };
const HISTORY = [{ keyword: "alpha", points: [] }];

const boundary = vi.hoisted(() => ({
  profile: vi.fn(),
  clients: vi.fn(),
  overview: vi.fn(),
  history: vi.fn(),
}));

vi.mock("@/components/features/user-profile/lib/profile", () => ({
  getProfileView: boundary.profile,
}));

vi.mock("@/lib/db/repository", () => ({
  listAccessibleClients: boundary.clients,
  getCachedDashboardOverview: boundary.overview,
  getCachedKeywordHistory: boundary.history,
}));

import { GET } from "./route";
import type { ProfileView } from "@/components/features/user-profile/lib/profile";

const PROFILE: ProfileView = {
  email: "admin@example.com",
  name: "Ada Admin",
  role: "admin",
  clientId: null,
  providers: ["google"],
};

function get(searchParams: Record<string, string> = {}) {
  const qs = new URLSearchParams(searchParams).toString();
  return GET(new Request(`http://localhost/api/dashboard/boot${qs ? `?${qs}` : ""}`));
}

function allow(profile = PROFILE, clients = CLIENTS) {
  boundary.profile.mockResolvedValue(profile);
  boundary.clients.mockResolvedValue(clients);
  boundary.overview.mockResolvedValue(OVERVIEW);
  boundary.history.mockResolvedValue(HISTORY);
}

afterEach(() => {
  vi.resetAllMocks();
});

describe("GET /api/dashboard/boot", () => {
  it("returns 401 without a session, before any read", async () => {
    boundary.profile.mockResolvedValue(null);

    const response = await get();
    expect(response.status).toBe(401);
    expect(boundary.clients).not.toHaveBeenCalled();
    expect(boundary.overview).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed client id", async () => {
    allow();

    const response = await get({ client: "not-a-uuid" });
    expect(response.status).toBe(400);
    expect(boundary.overview).not.toHaveBeenCalled();
  });

  it("returns profile, clients and the default selection in one payload", async () => {
    allow();

    const response = await get();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({
      profile: PROFILE,
      clients: CLIENTS,
      selection: {
        clientId: CLIENT_A,
        days: 7,
        payload: { overview: OVERVIEW, history: HISTORY },
      },
    });
    expect(boundary.overview).toHaveBeenCalledWith(CLIENTS[0], 7);
    expect(boundary.history).toHaveBeenCalledWith(CLIENTS[0], 7);
  });

  it("honours a deep-linked client and range", async () => {
    allow();

    const body = await (await get({ client: CLIENT_B, days: "30" })).json();
    expect(body.selection).toMatchObject({ clientId: CLIENT_B, days: 30 });
    expect(boundary.overview).toHaveBeenCalledWith(CLIENTS[1], 30);
  });

  it("falls back to the default range for an out-of-tree value", async () => {
    allow();

    const body = await (await get({ days: "14" })).json();
    expect(body.selection.days).toBe(7);
  });

  it("ignores a client id outside the caller's accessible set", async () => {
    allow(
      { ...PROFILE, role: "client", clientId: CLIENT_B },
      [CLIENTS[1]],
    );

    const body = await (await get({ client: CLIENT_A })).json();
    expect(body.selection.clientId).toBe(CLIENT_B);
  });

  it("returns a null selection when the account has no accessible client", async () => {
    allow(PROFILE, []);

    const response = await get();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ selection: null });
    expect(boundary.overview).not.toHaveBeenCalled();
  });

  it("returns 503 when the overview read fails", async () => {
    allow();
    boundary.overview.mockRejectedValue(new Error("read failed"));

    const response = await get();
    expect(response.status).toBe(503);
  });

  it("returns 503 when the identity read itself rejects", async () => {
    boundary.profile.mockRejectedValue(
      new Error("Supabase client configuration unavailable"),
    );

    const response = await get();
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Database operation failed",
    });
    expect(boundary.clients).not.toHaveBeenCalled();
    expect(boundary.overview).not.toHaveBeenCalled();
  });

  it("never caches a per-user payload", async () => {
    allow();

    const response = await get();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("vary")).toBe("Cookie");
  });
});
