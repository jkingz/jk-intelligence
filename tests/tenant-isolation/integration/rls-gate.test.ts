import { beforeAll, describe, expect, it, vi } from "vitest";

import { hasTestDb } from "../../helpers/db";

// Spec §6 (docs/superpowers/specs/2026-09-23-test-suite-architecture-design.md):
// the first live-RLS slice. Unlike the unit suites, nothing here is faked at
// the PostgREST boundary — the gate's SQL policies decide, so a green run is
// evidence about the database, not about our mocks.

vi.mock("next/headers", () => ({
  cookies: async () => getCurrentCookieStore(),
}));

// server-only and @supabase/ssr resolve their guards via conditions the
// integration project does not set; mirror the root vitest alias here.
vi.mock("server-only", () => ({}));

import {
  FIXTURE_USERS,
  provisionFixtures,
  withSession,
  getCurrentCookieStore,
  type TestClients,
} from "../../fixtures/identity-users";

describe.skipIf(!hasTestDb)("tenant gate against live RLS", () => {
  let clients: TestClients;

  beforeAll(async () => {
    clients = await provisionFixtures();
  });

  // Loading the repository after the vi.mock of next/headers is registered.
  async function gate() {
    return await import("@/lib/db/repository");
  }

  it("client@a sees client A and not client B via listAccessibleClients", async () => {
    const { listAccessibleClients } = await gate();
    await withSession(FIXTURE_USERS.clientA, async () => {
      const visible = await listAccessibleClients();
      expect(visible.map((c) => c.id)).toContain(clients.a);
      expect(visible.map((c) => c.id)).not.toContain(clients.b);
    });
  });

  it("canAccessClient is true for A and false for B as client@a", async () => {
    const { canAccessClient } = await gate();
    await withSession(FIXTURE_USERS.clientA, async () => {
      await expect(canAccessClient(clients.a)).resolves.toBe(true);
      await expect(canAccessClient(clients.b)).resolves.toBe(false);
    });
  });

  it("staff@a sees A and not B", async () => {
    const { listAccessibleClients, canAccessClient } = await gate();
    await withSession(FIXTURE_USERS.staffA, async () => {
      const visible = await listAccessibleClients();
      expect(visible.map((c) => c.id)).toContain(clients.a);
      expect(visible.map((c) => c.id)).not.toContain(clients.b);
      await expect(canAccessClient(clients.b)).resolves.toBe(false);
    });
  });

  it("an unauthenticated session is denied, not served", async () => {
    const { listAccessibleClients } = await gate();
    await withSession(null, async () => {
      // Live PostgREST runs a cookie-less request as `anon`, whose SELECT
      // grant the first migration revokes — so the gate throws (route: 503)
      // rather than resolving to an empty list. Either way nothing is read;
      // an accidental [] would be the softer failure.
      await expect(listAccessibleClients()).rejects.toThrow(
        "Database operation failed",
      );
    });
  });

  it("an admin session sees both clients", async () => {
    const { listAccessibleClients } = await gate();
    await withSession("admin@rls-test.local", async () => {
      const visible = await listAccessibleClients();
      expect(visible.map((c) => c.id)).toEqual(
        expect.arrayContaining([clients.a, clients.b]),
      );
    });
  });
});
