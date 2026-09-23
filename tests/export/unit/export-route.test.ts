import { afterEach, describe, expect, it, vi } from "vitest";

const CLIENT = "00000000-0000-4000-8000-000000000001";

const boundary = vi.hoisted(() => ({
  authUser: vi.fn(),
  accessibleClients: vi.fn(),
  latestSnapshotTime: vi.fn(),
  snapshots: vi.fn(),
  quota: vi.fn(),
}));

vi.mock("@/lib/agents/authAgent", () => ({ getAuthUser: boundary.authUser }));

vi.mock("@/lib/db/repository", () => ({
  listAccessibleClients: boundary.accessibleClients,
  listAllMetricSnapshots: boundary.snapshots,
  getLatestSnapshotTime: boundary.latestSnapshotTime,
}));

vi.mock("@/lib/exports/quota", () => ({ consumeExportQuota: boundary.quota }));

import { GET as csv } from "@/app/api/exports/[clientId]/csv/route";
import { GET as pdf } from "@/app/api/exports/[clientId]/pdf/route";

const dashboardClient = {
  id: CLIENT,
  name: "Northstar Studio",
  domain: "northstar.example",
  initials: "NS",
};

function get(handler: Handler, clientId: string, days?: string, path?: string) {
  const url = `http://localhost/api/exports/${clientId}/${path ?? "csv"}${
    days ? `?days=${days}` : ""
  }`;
  return handler(new Request(url, { method: "GET" }), {
    params: Promise.resolve({ clientId }),
  });
}

function allowAdmin(latestGsc: string | null = "2026-09-17T00:00:00.000Z") {
  boundary.authUser.mockResolvedValue({
    id: "00000000-0000-4000-8000-0000000000aa",
    role: "admin",
    clientId: null,
  });
  boundary.accessibleClients.mockResolvedValue([dashboardClient]);
  boundary.latestSnapshotTime.mockResolvedValue(latestGsc);
  boundary.quota.mockResolvedValue({ allowed: true });
}

afterEach(() => {
  vi.clearAllMocks();
});

type Handler = (request: Request, ctx: { params: Promise<{ clientId: string }> }) => Promise<Response>;

const handlers: Array<{
  name: string;
  handler: Handler;
  contentType: string;
  extension: string;
  suffix: string;
}> = [
  {
    name: "csv",
    handler: (request, ctx) => csv(request, ctx as RouteContext<"/api/exports/[clientId]/csv">),
    contentType: "text/csv; charset=utf-8",
    extension: "csv",
    suffix: "metrics",
  },
  {
    name: "pdf",
    handler: (request, ctx) => pdf(request, ctx as RouteContext<"/api/exports/[clientId]/pdf">),
    contentType: "application/pdf",
    extension: "pdf",
    suffix: "report",
  },
];

for (const { name, handler, contentType, extension, suffix } of handlers) {
  describe(`GET /api/exports/[clientId]/${name}`, () => {
    it("returns 400 for a malformed client id", async () => {
      const response = await get(handler, "not-a-uuid");
      expect(response.status).toBe(400);
      expect(boundary.snapshots).not.toHaveBeenCalled();
    });

    it("returns 400 for an invalid days range", async () => {
      const response = await get(handler, CLIENT, "14");
      expect(response.status).toBe(400);
      expect(boundary.snapshots).not.toHaveBeenCalled();
    });

    it("returns 401 for unauthenticated requests", async () => {
      boundary.authUser.mockResolvedValue(null);
      const response = await get(handler, CLIENT, "30");
      expect(response.status).toBe(401);
      expect(boundary.snapshots).not.toHaveBeenCalled();
    });

    it("returns 403 when the client is outside the accessible set", async () => {
      boundary.authUser.mockResolvedValue({ id: "u1", role: "client", clientId: "other" });
      boundary.accessibleClients.mockResolvedValue([]);
      const response = await get(handler, CLIENT, "30");
      expect(response.status).toBe(403);
    });

    it("returns 503 when the read fails", async () => {
      allowAdmin();
      boundary.snapshots.mockRejectedValue(new Error("Database operation failed"));
      const response = await get(handler, CLIENT, "30");
      expect(response.status).toBe(503);
    });

    it("returns 503 without spending quota when the tenant gate rejects", async () => {
      allowAdmin();
      boundary.accessibleClients.mockRejectedValue(
        new Error("Database operation failed"),
      );

      const response = await get(handler, CLIENT, "30");
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({
        error: "Database operation failed",
      });
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(boundary.quota).not.toHaveBeenCalled();
      expect(boundary.snapshots).not.toHaveBeenCalled();
    });

    it("returns 503 before the gate when the identity read rejects", async () => {
      allowAdmin();
      boundary.authUser.mockRejectedValue(
        new Error("Supabase client configuration unavailable"),
      );

      const response = await get(handler, CLIENT, "30");
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({
        error: "Database operation failed",
      });
      expect(boundary.accessibleClients).not.toHaveBeenCalled();
      expect(boundary.quota).not.toHaveBeenCalled();
    });

    it("downloads with the right content type, filename and no-store", async () => {
      allowAdmin();
      boundary.snapshots.mockResolvedValue([
        {
          source: "gsc",
          syncedAt: "2026-09-17T00:00:00.000Z",
          metrics: [
            {
              clicks: 10,
              impressions: 100,
              ctr: 10,
              position: 3,
              conversions: 1,
              keyword: "alpha",
              rank: 3,
              searchVolume: 500,
            },
          ],
        },
      ]);

      const response = await get(handler, CLIENT, "7");
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe(contentType);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      const today = new Date().toISOString().slice(0, 10);
      expect(response.headers.get("Content-Disposition")).toBe(
        `attachment; filename="northstar-studio-${suffix}-7d-${today}.${extension}"`,
      );
      expect(boundary.snapshots).toHaveBeenCalledWith(
        CLIENT,
        expect.any(String),
        expect.any(String),
      );
    });

    it("reads back far enough for the prior period when sync is stale", async () => {
      allowAdmin("2026-09-01T00:00:00.000Z");
      boundary.snapshots.mockResolvedValue([]);
      const response = await get(handler, CLIENT, "7");

      expect(response.status).toBe(200);
      expect(boundary.latestSnapshotTime).toHaveBeenCalledWith(CLIENT, "gsc");
      // 2026-09-01 minus 2×7 days plus one day of slack — never wall-clock based,
      // so the prior-period rows a stale sync leaves behind are still read.
      expect(boundary.snapshots.mock.calls[0]![1]).toBe("2026-08-17T00:00:00.000Z");
      expect(Date.parse(boundary.snapshots.mock.calls[0]![2]!)).toBeGreaterThanOrEqual(
        Date.parse("2026-09-01T00:00:00.000Z"),
      );
    });

    it("returns 429 with Retry-After once the quota is spent", async () => {
      allowAdmin();
      boundary.quota.mockResolvedValue({ allowed: false, retryAfterSeconds: 42 });
      boundary.snapshots.mockResolvedValue([]);

      const response = await get(handler, CLIENT, "7");
      expect(response.status).toBe(429);
      expect(response.headers.get("Retry-After")).toBe("42");
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(boundary.snapshots).not.toHaveBeenCalled();
    });
  });
}
