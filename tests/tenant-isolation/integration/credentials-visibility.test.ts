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

// The columns the Connections page needs. The prohibition is on the application
// read path: RULES.md §16 means listConnections names these three and no
// response, log line or cache entry ever carries `credential_reference`. The one
// deliberate exception is the negative case below, which names the column only
// to prove Postgres refuses it, and discards `data` so no value can reach an
// assertion or a log.
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

  // Same session path as credentials(), but naming whichever columns the test
  // asks for. A column Postgres has stopped granting comes back as a
  // PostgREST error, and databaseOperation()'s message is the one the rest of
  // this file already asserts.
  async function selectAs(email: string, columns: string): Promise<void> {
    await withSession(email, async () => {
      const { createServerSupabaseClient } = await import("@/lib/supabase/server");
      const db = await createServerSupabaseClient();
      const { error } = await db.from("api_credentials").select(columns);
      if (error) throw new Error("Database operation failed");
    });
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

  it("a tenant reads the three status columns and nothing else", async () => {
    // The positive half of the pair: whatever Task 4 does to the grant, this
    // page's own read must keep working. /connections selects exactly these.
    await expect(
      selectAs(FIXTURE_USERS.clientA, COLUMNS),
    ).resolves.toBeUndefined();
  });

  it("a tenant cannot select credential_reference at the database", async () => {
    // The point of the unit. Not "the app never asks for it" — that is
    // tests/tenant-isolation/unit/connections-read.test.ts:113 — but "asking
    // for it is refused by Postgres", which only a live session can show.
    await expect(
      selectAs(FIXTURE_USERS.clientA, "credential_reference"),
    ).rejects.toThrow("Database operation failed");
  });
});
