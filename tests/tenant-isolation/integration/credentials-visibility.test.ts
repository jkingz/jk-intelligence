import { beforeAll, describe, expect, it, vi } from "vitest";

import { hasTestDb } from "../../helpers/db";

// Second live-RLS slice, over api_credentials. Nothing is faked at PostgREST,
// so a green run is evidence about the policy, not about a mock. NEVER EXECUTED
// in CI — see the deviation note at the top of this plan; quote the skip line in
// context/progress-tracker.md rather than claiming coverage.
vi.mock("next/headers", () => ({
  cookies: async () => getCurrentCookieStore(),
}));
vi.mock("server-only", () => ({}));

import {
  FIXTURE_USERS,
  provisionFixtures,
  withSession,
  getCurrentCookieStore,
  type TestClients,
} from "../../fixtures/identity-users";

// The columns the Connections page needs. Deliberately not
// `credential_reference`: RULES.md §16 keeps a credential out of every response
// and log line, and a test that selected it would be the first place that
// invariant got quietly relaxed. Task 5's unit test owns the "we never read the
// reference" assertion for the application path.
const COLUMNS = "client_id,source,created_at";

interface CredentialRowShape {
  client_id: string;
  source: string;
  created_at: string;
}

describe.skipIf(!hasTestDb)("api_credentials visibility against live RLS", () => {
  let clients: TestClients;

  beforeAll(async () => {
    clients = await provisionFixtures();
  });

  // Imported inside the call so it resolves after the next/headers mock is
  // registered, and picks up whichever fixture session withSession installed.
  async function credentials(): Promise<CredentialRowShape[]> {
    const { createServerSupabaseClient } = await import("@/lib/supabase/server");
    const db = await createServerSupabaseClient();
    const { data, error } = await db
      .from("api_credentials")
      .select(COLUMNS)
      .order("client_id");
    if (error) throw new Error("Database operation failed");
    return data as CredentialRowShape[];
  }

  it("client@a sees its own tenant's credential and no other", async () => {
    await withSession(FIXTURE_USERS.clientA, async () => {
      const rows = await credentials();
      expect(rows.map((row) => row.client_id)).toEqual([clients.a]);
      expect(rows[0].source).toBe("semrush");
    });
  });

  it("staff@a reaches the same row, which is the whole staff grant", async () => {
    await withSession(FIXTURE_USERS.staffA, async () => {
      const rows = await credentials();
      expect(rows.map((row) => row.client_id)).toEqual([clients.a]);
    });
  });

  it("an admin sees every provisioned tenant", async () => {
    await withSession("admin@rls-test.local", async () => {
      const rows = await credentials();
      expect(rows.map((row) => row.client_id)).toEqual(
        expect.arrayContaining([clients.a, clients.b]),
      );
    });
  });

  it("a cookie-less call throws rather than returning everything", async () => {
    await withSession(null, async () => {
      // PostgREST runs this as `anon`, whose SELECT grant
      // 20260917000000_seo_poc.sql:201 revoked and this migration does not
      // re-grant. An accidental [] would be the softer, easier-to-miss bug —
      // the same argument rls-gate.test.ts:65-76 makes.
      await expect(credentials()).rejects.toThrow("Database operation failed");
    });
  });
});
