import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const boundary = vi.hoisted(() => ({
  scoped: vi.fn(),
  admin: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: boundary.scoped,
}));
vi.mock("@/lib/db/admin", () => ({ getAdminDb: boundary.admin }));

import { listConnections } from "@/lib/db/repository";
import { calls, EMPTY_PAGE, fakeDb } from "../../helpers/fake-postgrest";

const A = {
  id: "00000000-0000-4000-8000-00000000000a",
  name: "Atlas Coffee",
  domain: "atlas.example",
  is_active: true,
};
const CREDENTIALS = [
  {
    client_id: A.id,
    source: "semrush",
    created_at: "2026-09-12T00:00:00.000+00:00",
  },
];

afterEach(() => {
  boundary.scoped.mockReset();
  boundary.admin.mockReset();
  calls.length = 0;
});

describe("listConnections", () => {
  it("reads both relations as the signed-in user, never the admin client", async () => {
    // listAccessibleClients pages clients (one page + the short page that ends
    // the loop), then api_credentials is read — sequential on purpose so the
    // fake's canned results are consumed in a deterministic order.
    boundary.scoped.mockResolvedValue(
      fakeDb("scoped", [
        { data: [A], error: null },
        EMPTY_PAGE,
        { data: CREDENTIALS, error: null },
      ]),
    );
    boundary.admin.mockReturnValue(fakeDb("admin", []));

    await expect(listConnections()).resolves.toEqual([
      {
        client: { id: A.id, name: A.name, domain: A.domain, initials: "AC" },
        sources: [{ source: "semrush", linkedAt: "2026-09-12T00:00:00.000+00:00" }],
      },
    ]);
    expect(boundary.admin).not.toHaveBeenCalled();
    expect(calls).toContain("scoped.from(api_credentials)");
  });

  it("selects the reference column never", async () => {
    boundary.scoped.mockResolvedValue(
      fakeDb("scoped", [
        { data: [A], error: null },
        EMPTY_PAGE,
        { data: CREDENTIALS, error: null },
      ]),
    );
    await listConnections();
    const select = calls.find((call) => call.endsWith("select(client_id,source,created_at)"));
    expect(select).toBeDefined();
    expect(calls.join(" ")).not.toContain("credential_reference");
  });

  it("returns nothing without spending a credential query", async () => {
    // An unprovisioned account has no tenants to look credentials up for; the
    // early return is the whole empty state, and it must stay the empty state.
    boundary.scoped.mockResolvedValue(fakeDb("scoped", [EMPTY_PAGE]));
    await expect(listConnections()).resolves.toEqual([]);
    expect(calls.filter((c) => c.includes("api_credentials"))).toEqual([]);
  });

  it("rejects when RLS hides the table from the caller", async () => {
    boundary.scoped.mockResolvedValue(
      fakeDb("scoped", [
        { data: [A], error: null },
        EMPTY_PAGE,
        { data: null, error: { message: "permission denied for table api_credentials" } },
      ]),
    );
    await expect(listConnections()).rejects.toThrow("Database operation failed");
  });
});
