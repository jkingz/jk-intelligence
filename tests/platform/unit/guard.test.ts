import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  badRequest,
  databaseFailure,
  firstIssueMessage,
  forbidden,
  gateAdmin,
  gateClientAccess,
  gateNullable,
  gateSession,
  json,
  readJsonBody,
  resolveAccessibleClient,
  unauthorized,
} from "@/lib/api/guard";

const boundary = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  requireAdmin: vi.fn(),
  canAccessClient: vi.fn(),
  listAccessibleClients: vi.fn(),
}));

vi.mock("@/lib/agents/authAgent", () => ({
  getAuthUser: boundary.getAuthUser,
  requireAdmin: boundary.requireAdmin,
}));

vi.mock("@/lib/db/repository", () => ({
  canAccessClient: boundary.canAccessClient,
  listAccessibleClients: boundary.listAccessibleClients,
}));

const CLIENT_ID = "00000000-0000-4000-8000-000000000002";
const USER = { id: "00000000-0000-4000-8000-000000000001", role: "client", clientId: CLIENT_ID };
const CLIENT = { id: CLIENT_ID, name: "Atlas", domain: "atlas.example", initials: "AC" };

afterEach(() => {
  vi.resetAllMocks();
});

describe("response shape", () => {
  it("answers every status from one header set, with no shared-cache freshness", async () => {
    for (const response of [json({ ok: true }, 200), badRequest("no"), unauthorized(), forbidden(), databaseFailure()]) {
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(response.headers.get("Cache-Control")).not.toMatch(/public|s-maxage|stale-while-revalidate/);
      expect(response.headers.get("Vary")).toBe("Cookie");
      expect(response.headers.get("Content-Type")).toBe("application/json");
    }
    expect(await unauthorized().json()).toEqual({ error: "Unauthorized" });
    expect(await forbidden().json()).toEqual({ error: "Forbidden" });
    expect(await databaseFailure().json()).toEqual({ error: "Database operation failed" });
    expect(await badRequest("Invalid client id").json()).toEqual({ error: "Invalid client id" });
  });

  it("lets a caller add one header without touching the cache pair", async () => {
    const response = json({ error: "Export limit reached" }, 429, { "Retry-After": "42" });
    expect(response.headers.get("Retry-After")).toBe("42");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.status).toBe(429);
  });

  it("keeps the cache pair even when a caller tries to replace it", () => {
    const response = json({ ok: true }, 200, {
      "Cache-Control": "public, s-maxage=60",
      vary: "Accept-Encoding",
      "Retry-After": "42",
    });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Vary")).toBe("Cookie");
    expect(response.headers.get("Retry-After")).toBe("42");
  });

  it("keeps the zod sentence the caller wrote", () => {
    const parsed = z.object({ name: z.string().min(3) }).safeParse({ name: "a" });
    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error("expected a rejection");
    // Not the message text itself: zod owns that wording, this test owns the
    // "first issue, verbatim, nothing invented" rule.
    expect(firstIssueMessage(parsed.error)).toBe(parsed.error.issues[0]?.message);
    expect(firstIssueMessage(parsed.error)).not.toHaveLength(0);
  });

  it("names a non-JSON body the way the admin panel already does", async () => {
    const request = new Request("http://localhost/api/admin/clients", { method: "POST", body: "name=Atlas" });
    expect(await readJsonBody(request)).toEqual({ ok: false, message: "Send a JSON body." });
  });
});

describe("gateNullable", () => {
  it("passes a value through", async () => {
    const gate = await gateNullable(async () => CLIENT);
    expect(gate).toEqual({ allow: true, value: CLIENT });
  });

  it("treats null as 401, not as 403", async () => {
    const gate = await gateNullable(async () => null);
    expect(gate.allow).toBe(false);
    if (!gate.allow) expect(gate.response.status).toBe(401);
  });

  it("treats a rejected read as 503, never as 401", async () => {
    const gate = await gateNullable(async () => {
      throw new Error("Supabase client configuration unavailable");
    });
    if (gate.allow) throw new Error("expected a denial");
    expect(gate.response.status).toBe(503);
    await expect(gate.response.json()).resolves.toEqual({ error: "Database operation failed" });
  });
});

describe("gateSession", () => {
  it("returns the user when there is one", async () => {
    boundary.getAuthUser.mockResolvedValue(USER);
    expect(await gateSession()).toEqual({ allow: true, value: USER });
  });

  it("401s a signed-in subject with no provisioned users row", async () => {
    boundary.getAuthUser.mockResolvedValue(null);
    const gate = await gateSession();
    if (gate.allow) throw new Error("expected a denial");
    expect(gate.response.status).toBe(401);
  });
});

describe("gateAdmin", () => {
  it("maps unauthenticated to 401 and forbidden to 403 — requireAdmin's own reasons", async () => {
    boundary.requireAdmin.mockResolvedValue({ allow: false, reason: "unauthenticated" });
    const anonymous = await gateAdmin();
    expect(anonymous.allow).toBe(false);
    if (anonymous.allow) throw new Error("expected a denial");
    expect(anonymous.response.status).toBe(401);
    boundary.requireAdmin.mockResolvedValue({ allow: false, reason: "forbidden" });
    const gate = await gateAdmin();
    if (gate.allow) throw new Error("expected a denial");
    expect(gate.response.status).toBe(403);
    expect(boundary.getAuthUser).not.toHaveBeenCalled();
  });

  it("503s when the role read throws", async () => {
    boundary.requireAdmin.mockRejectedValue(new Error("connection reset"));
    const gate = await gateAdmin();
    if (gate.allow) throw new Error("expected a denial");
    expect(gate.response.status).toBe(503);
  });
});

describe("tenant gates", () => {
  it("gateClientAccess forwards the id to canAccessClient and 403s false", async () => {
    boundary.canAccessClient.mockResolvedValue(false);
    const gate = await gateClientAccess(CLIENT.id);
    expect(boundary.canAccessClient).toHaveBeenCalledWith(CLIENT.id);
    expect(gate.allow).toBe(false);
    if (!gate.allow) expect(gate.response.status).toBe(403);
  });

  it("gateClientAccess 503s when the RLS probe throws — fail closed, not open", async () => {
    boundary.canAccessClient.mockRejectedValue(new Error("Database operation failed"));
    const gate = await gateClientAccess(CLIENT.id);
    if (gate.allow) throw new Error("expected a denial");
    expect(gate.response.status).toBe(503);
  });

  it("resolveAccessibleClient hands back the row RLS allowed, by identity", async () => {
    boundary.listAccessibleClients.mockResolvedValue([CLIENT]);
    const gate = await resolveAccessibleClient(CLIENT.id);
    if (!gate.allow) throw new Error("expected access");
    expect(gate.value).toBe(CLIENT);
  });

  it("resolveAccessibleClient 403s a client the caller cannot see", async () => {
    boundary.listAccessibleClients.mockResolvedValue([]);
    const gate = await resolveAccessibleClient(CLIENT.id);
    expect(gate.allow).toBe(false);
    if (!gate.allow) expect(gate.response.status).toBe(403);
  });
});
