import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const boundary = vi.hoisted(() => ({
  scoped: vi.fn(),
  admin: vi.fn(),
  calls: [] as string[],
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: boundary.scoped,
}));

vi.mock("@/lib/db/admin", () => ({
  getAdminDb: boundary.admin,
}));

import { canAccessClient, listAccessibleClients, listActiveClients } from "@/lib/db/repository";

type Result = { data: unknown; error: { message: string } | null };

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

/**
 * Chainable, awaitable fake for the PostgREST query builder: `from()` returns a
 * chain where every link method records itself, and awaiting the chain consumes
 * the next canned result. Only the chain is thenable — a thenable `db` root
 * would be unwrapped by the `await` on `createServerSupabaseClient()`.
 */
function fakeDb(label: string, results: Result[]) {
  let step = 0;
  const chain: Record<string, unknown> = new Proxy({} as Record<string, unknown>, {
    get(_target, prop: string) {
      if (prop === "then") {
        return (resolve: (value: Result) => void) => resolve(results[step++]);
      }
      return (...args: unknown[]) => {
        boundary.calls.push(`${label}.${prop}(${args.map(String).join(",")})`);
        return chain;
      };
    },
  });
  return {
    from(table: string) {
      boundary.calls.push(`${label}.from(${table})`);
      return chain;
    },
  };
}

const EMPTY_PAGE: Result = { data: [], error: null };

afterEach(() => {
  boundary.scoped.mockReset();
  boundary.admin.mockReset();
  boundary.calls.length = 0;
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
    expect(boundary.calls.filter((call) => call.startsWith("admin."))).toEqual([]);
  });

  it("returns nothing when RLS hides every client", async () => {
    // An authenticated role with no matching policy gets an empty result set,
    // which is the whole point of routing the gate through RLS.
    boundary.scoped.mockResolvedValue(fakeDb("scoped", [EMPTY_PAGE]));

    await expect(listAccessibleClients()).resolves.toEqual([]);
    expect(boundary.calls).toContain("scoped.eq(is_active,true)");
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
    expect(boundary.calls.filter((call) => call.startsWith("scoped.gt(id,"))).toEqual([
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
    expect(boundary.calls).toContain(`scoped.from(clients)`);
    expect(boundary.calls).toContain(`scoped.eq(id,${ALPHA.id})`);
    expect(boundary.calls).toContain("scoped.eq(is_active,true)");
  });

  it("denies a forged client id that RLS filters out", async () => {
    boundary.scoped.mockResolvedValue(fakeDb("scoped", [{ data: null, error: null }]));

    await expect(canAccessClient(BETA.id)).resolves.toBe(false);
  });

  it("denies inactive clients", async () => {
    boundary.scoped.mockResolvedValue(fakeDb("scoped", [{ data: null, error: null }]));

    await expect(canAccessClient(ALPHA.id)).resolves.toBe(false);
    expect(boundary.calls).toContain("scoped.eq(is_active,true)");
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
