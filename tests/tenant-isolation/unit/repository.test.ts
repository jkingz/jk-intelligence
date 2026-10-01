import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const boundary = vi.hoisted(() => ({
  scoped: vi.fn(),
  admin: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: boundary.scoped,
}));

vi.mock("@/lib/db/admin", () => ({
  getAdminDb: boundary.admin,
}));

import { canAccessClient, listAccessibleClients, listActiveClients } from "@/lib/db/repository";
import { calls, EMPTY_PAGE, fakeDb } from "../../helpers/fake-postgrest";

const ALPHA = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Atlas Coffee",
  domain: "atlas.example",
  is_active: true,
};
const BETA = {
  id: "00000000-0000-4000-8000-000000000002",
  name: "Borealis Bikes",
  domain: "borealis.example",
  is_active: true,
};

afterEach(() => {
  boundary.scoped.mockReset();
  boundary.admin.mockReset();
  calls.length = 0;
});

describe("listAccessibleClients", () => {
  it("reads as the signed-in user so RLS decides visibility", async () => {
    boundary.scoped.mockResolvedValue(
      fakeDb("scoped", [{ data: [ALPHA], error: null }, EMPTY_PAGE]),
    );
    boundary.admin.mockReturnValue(fakeDb("admin", []));

    await expect(listAccessibleClients()).resolves.toEqual([
      { id: ALPHA.id, name: ALPHA.name, domain: ALPHA.domain, initials: "AC" },
    ]);

    expect(boundary.scoped).toHaveBeenCalledTimes(1);
    expect(boundary.admin).not.toHaveBeenCalled();
    expect(calls.filter((call) => call.startsWith("admin."))).toEqual([]);
  });

  it("returns nothing when RLS hides every client", async () => {
    // An authenticated role with no matching policy gets an empty result set,
    // which is the whole point of routing the gate through RLS.
    boundary.scoped.mockResolvedValue(fakeDb("scoped", [EMPTY_PAGE]));

    await expect(listAccessibleClients()).resolves.toEqual([]);
    expect(calls).toContain("scoped.eq(is_active,true)");
  });

  it("keeps paging until PostgREST returns a short page", async () => {
    boundary.scoped.mockResolvedValue(
      fakeDb("scoped", [
        { data: [ALPHA], error: null },
        { data: [BETA], error: null },
        EMPTY_PAGE,
      ]),
    );

    const clients = await listAccessibleClients();
    expect(clients.map((client) => client.id)).toEqual([ALPHA.id, BETA.id]);
    // A third page (keyset after BETA) is what terminates the loop.
    expect(calls.filter((call) => call.startsWith("scoped.gt(id,"))).toEqual([
      `scoped.gt(id,${ALPHA.id})`,
      `scoped.gt(id,${BETA.id})`,
    ]);
  });
});

describe("canAccessClient", () => {
  it("allows a client the caller can see", async () => {
    boundary.scoped.mockResolvedValue(
      fakeDb("scoped", [{ data: { id: ALPHA.id }, error: null }]),
    );

    await expect(canAccessClient(ALPHA.id)).resolves.toBe(true);
    expect(boundary.admin).not.toHaveBeenCalled();
    expect(calls).toContain(`scoped.from(clients)`);
    expect(calls).toContain(`scoped.eq(id,${ALPHA.id})`);
    expect(calls).toContain("scoped.eq(is_active,true)");
  });

  it("denies a forged client id that RLS filters out", async () => {
    boundary.scoped.mockResolvedValue(fakeDb("scoped", [{ data: null, error: null }]));

    await expect(canAccessClient(BETA.id)).resolves.toBe(false);
  });

  it("denies inactive clients", async () => {
    boundary.scoped.mockResolvedValue(fakeDb("scoped", [{ data: null, error: null }]));

    await expect(canAccessClient(ALPHA.id)).resolves.toBe(false);
    expect(calls).toContain("scoped.eq(is_active,true)");
  });

  it("fails closed when the read errors", async () => {
    boundary.scoped.mockResolvedValue(
      fakeDb("scoped", [{ data: null, error: { message: "permission denied" } }]),
    );

    await expect(canAccessClient(ALPHA.id)).rejects.toThrow("Database operation failed");
  });
});

describe("listActiveClients", () => {
  it("stays on the service-role client because cron has no session", async () => {
    boundary.admin.mockReturnValue(
      fakeDb("admin", [{ data: [ALPHA], error: null }, EMPTY_PAGE]),
    );

    const clients = await listActiveClients();
    expect(clients).toEqual([ALPHA]);
    expect(boundary.scoped).not.toHaveBeenCalled();
  });
});
