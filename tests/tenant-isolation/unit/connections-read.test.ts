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

/**
 * Every `unstable_cache` registration in this module graph, recorded so a case can
 * assert that none of its wrappers served the connections read. `repository.ts`
 * registers two dashboard caches at module scope (`:375`, `:400`), so "the mock was
 * never called" is not assertable here — importing `listConnections` would fail it
 * before any test body runs. What must hold is that the read is never *served*
 * through one, which is what `wrapperKeysUsedForTheRead()` measures.
 */
const cached = vi.hoisted(() => ({
  entries: [] as { key: string; invoked: number }[],
}));

vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown, key?: readonly string[]) => {
    const entry = { key: (key ?? []).join(","), invoked: 0 };
    cached.entries.push(entry);
    return (...args: unknown[]) => {
      entry.invoked += 1;
      return fn(...args);
    };
  },
  revalidateTag: () => undefined,
  revalidatePath: () => undefined,
}));

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

/** The cache keys whose wrapper ran since the last case, which is the whole rule:
 *  `listConnections()` chains a cookie-bound Supabase client, so a wrapper around
 *  it — or around the credential read inside it — would key a cross-request entry
 *  on nothing and serve the first caller's client names, domains and link dates to
 *  every later user. Empty means the read went to Postgres as the caller. */
function wrapperKeysUsedForTheRead(): string[] {
  return cached.entries.filter((entry) => entry.invoked > 0).map((entry) => entry.key);
}

afterEach(() => {
  boundary.scoped.mockReset();
  boundary.admin.mockReset();
  calls.length = 0;
  // Localises a leak to the case that caused it.
  for (const entry of cached.entries) entry.invoked = 0;
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
    // Proves the `next/cache` mock is wired into this module graph, so the guard
    // below can fail: `repository.ts`'s own caches must be registered here.
    expect(cached.entries.map((entry) => entry.key)).toContain("dashboard-overview");
    expect(wrapperKeysUsedForTheRead()).toEqual([]);
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
    expect(wrapperKeysUsedForTheRead()).toEqual([]);
  });

  it("returns nothing without spending a credential query", async () => {
    // An unprovisioned account has no tenants to look credentials up for; the
    // early return is the whole empty state, and it must stay the empty state.
    boundary.scoped.mockResolvedValue(fakeDb("scoped", [EMPTY_PAGE]));
    await expect(listConnections()).resolves.toEqual([]);
    expect(calls.filter((c) => c.includes("api_credentials"))).toEqual([]);
    expect(wrapperKeysUsedForTheRead()).toEqual([]);
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
    // Without this the case cannot tell "RLS denied the caller" from "the fake
    // ran out of canned results": a wrong-client read reaches the unset
    // `boundary.admin`, and `databaseOperation`'s catch-all re-emits the same
    // message. This assertion is per-case and does not generalise —
    // `repository.test.ts`'s cron case asserts the opposite boundary on purpose.
    expect(boundary.admin).not.toHaveBeenCalled();
    expect(wrapperKeysUsedForTheRead()).toEqual([]);
  });
});
