import { beforeAll, describe, expect, it, vi } from "vitest";

import { hasTestDb } from "../../helpers/db";

// Second live-RLS slice, over api_credentials. Nothing is faked at PostgREST,
// so a green run is evidence about the policy, not about a mock. CI runs
// `pnpm test`, which is the unit project only — this tier needs the local stack
// plus a filled `.env.test`, and without them skipIf leaves it unexecuted.
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

// The columns the Connections page needs, and no more. The prohibition is on the
// application read path: AGENTS.md § STANDING RULES 16 keeps `credential_reference` out of every
// response and log line, `listConnections` names exactly these three
// (`lib/db/repository.ts:333-334`), and
// `tests/tenant-isolation/unit/connections-read.test.ts:102-115` pins that. The
// one deliberate exception is the negative case below, which names the column
// only to prove Postgres refuses it, and discards `data` so no value can reach an
// assertion or a log.
const COLUMNS = "client_id,source,created_at";

interface CredentialRowShape {
  client_id: string;
  source: string;
  created_at: string;
}

// A refused select keeps the SQLSTATE PostgREST reported. "An error happened" is
// not the claim the docs make — they name `42501`, and only the code tells a
// denied column apart from one that stopped existing. The app's own wrapper is
// what the read path throws, and it discards the code, so the code has to be
// carried here for the docs' wording to be testable at all.
class RefusedSelect extends Error {
  constructor(readonly sqlState: string) {
    super("Database operation failed");
  }
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
  // asks for, and keeping the SQLSTATE instead of flattening it. `data` is
  // discarded either way, so a red run cannot print a reference value.
  async function selectAs(email: string, columns: string): Promise<void> {
    await withSession(email, async () => {
      const { createServerSupabaseClient } = await import("@/lib/supabase/server");
      const db = await createServerSupabaseClient();
      const { error } = await db.from("api_credentials").select(columns);
      if (error) throw new RefusedSelect(error.code);
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

  it("a tenant reads the three status columns it is granted", async () => {
    // The positive half of the pair: the grant may narrow, but it must not cut
    // these — /connections selects exactly these three.
    await expect(
      selectAs(FIXTURE_USERS.clientA, COLUMNS),
    ).resolves.toBeUndefined();
  });

  it("a tenant cannot select credential_reference at the database", async () => {
    // The point of the unit. Not "the app never asks for it" — that is
    // tests/tenant-isolation/unit/connections-read.test.ts:113 — but "asking
    // for it is refused by Postgres", which only a live session can show. The
    // SQLSTATE is the assertion, not the fact of an error: `AGENTS.md` and
    // `09-connections.md` quote 42501, and any other code would mean the column
    // had gone missing rather than being guarded — this tier green, the docs
    // false. Renaming or dropping the column produces PGRST204, which is exactly
    // the failure this case would otherwise sleep through.
    const refusal = await selectAs(FIXTURE_USERS.clientA, "credential_reference").then(
      () => undefined,
      (err: unknown) => err as RefusedSelect,
    );
    expect(refusal).toBeInstanceOf(RefusedSelect);
    expect(refusal?.sqlState).toBe("42501");
  });
});
