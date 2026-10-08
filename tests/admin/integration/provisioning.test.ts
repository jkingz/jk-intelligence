import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { hasTestDb } from "../../helpers/db";
import type { AdminRpcError } from "@/lib/admin/rpc";

// The admin RPCs are the enforcement point, so this file is evidence about
// Postgres: a non-admin must be refused by the function, not by a handler that
// happens to check first. NEVER EXECUTED in CI — quote the skip line in
// context/progress-tracker.md rather than claiming coverage.
vi.mock("next/headers", () => ({
  cookies: async () => getCurrentCookieStore(),
}));
vi.mock("server-only", () => ({}));

import {
  FIXTURE_PASSWORD,
  FIXTURE_USERS,
  adminDb,
  getCurrentCookieStore,
  provisionFixtures,
  withSession,
  type TestClients,
} from "../../fixtures/identity-users";

const SCRATCH_EMAIL = "scratch@admin-test.local";

async function rpc() {
  return await import("@/lib/admin/rpc");
}

describe.skipIf(!hasTestDb)("admin provisioning RPCs against live Postgres", () => {
  let clients: TestClients;
  let scratchId = "";

  beforeAll(async () => {
    clients = await provisionFixtures();
  });

  afterEach(async () => {
    if (scratchId) {
      await adminDb().from("users").delete().eq("id", scratchId);
      await adminDb().auth.admin.deleteUser(scratchId);
      scratchId = "";
    }
  });

  async function scratchUser(): Promise<string> {
    const db = adminDb();
    const { data: existing } = await db.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    const found = existing?.users.find((u) => u.email === SCRATCH_EMAIL);
    if (found) {
      await db.from("users").delete().eq("id", found.id);
      return found.id;
    }
    const { data, error } = await db.auth.admin.createUser({
      email: SCRATCH_EMAIL,
      password: FIXTURE_PASSWORD,
      email_confirm: true,
      user_metadata: { name: "Scratch Member" },
    });
    if (error || !data.user) throw new Error(`scratch user: ${error?.message}`);
    return data.user.id;
  }

  it("refuses a client-role caller with 42501 before touching a row", async () => {
    const { AdminRpcError, callAdminRpc } = await rpc();
    scratchId = await scratchUser();
    await withSession(FIXTURE_USERS.clientA, async () => {
      const failure = await callAdminRpc("admin_create_client", {
        p_name: "Refused Client",
        p_domain: "refused.admin-test.local",
      }).catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(AdminRpcError);
      expect((failure as AdminRpcError).code).toBe("42501");
    });
    // The nested helper resolved the caller, not the function owner.
    const { data } = await adminDb()
      .from("clients")
      .select("id")
      .eq("domain", "refused.admin-test.local")
      .maybeSingle();
    expect(data).toBeNull();
  });

  it("refuses the directory read to a staff session, too", async () => {
    // Regression for the leak the first draft of the migration shipped with:
    // an unguarded `language sql admin_directory()` handed every account's
    // email to any staff session (measured, 4 rows). The row count is not the
    // assertion here — the refusal is.
    const { AdminRpcError, callAdminRpc } = await rpc();
    await withSession(FIXTURE_USERS.staffA, async () => {
      const failure = await callAdminRpc("admin_directory", {}).catch(
        (error: unknown) => error,
      );
      expect(failure).toBeInstanceOf(AdminRpcError);
      expect((failure as AdminRpcError).code).toBe("42501");
    });
  });

  it("refuses an unauthenticated caller", async () => {
    const { AdminRpcError, callAdminRpc } = await rpc();
    await withSession(null, async () => {
      const failure = await callAdminRpc("admin_detach_member", {
        p_user_id: clients.a,
      }).catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(AdminRpcError);
    });
  });

  it("creates a client with a lowercased domain, and refuses the case-variant duplicate", async () => {
    const { callAdminRpc } = await rpc();
    const db = adminDb();
    await withSession(FIXTURE_USERS.admin, async () => {
      const created = await callAdminRpc("admin_create_client", {
        p_name: "Duplicate Probe",
        p_domain: "MixedCase.Admin-Test.local",
      });
      expect(created.domain).toBe("mixedcase.admin-test.local");
      await db.from("clients").delete().eq("id", created.id);

      await callAdminRpc("admin_create_client", {
        p_name: "Domain Owner",
        p_domain: "owned.admin-test.local",
      });
      const collision = await callAdminRpc("admin_create_client", {
        p_name: "Another Owner",
        p_domain: "OWNED.admin-test.local",
      }).catch((error: unknown) => error);
      expect((collision as { code?: string }).code).toBe("23505");
    });
    await db.from("clients").delete().eq("domain", "owned.admin-test.local");
  });

  it("attaches a provisioned-less account, then nulls its tenant on promotion", async () => {
    const { callAdminRpc } = await rpc();
    scratchId = await scratchUser();
    await withSession(FIXTURE_USERS.admin, async () => {
      const attached = await callAdminRpc("admin_attach_member", {
        p_user_id: scratchId,
        p_role: "client",
        p_client_id: clients.a,
      });
      expect(attached.client_id).toBe(clients.a);

      const promoted = await callAdminRpc("admin_attach_member", {
        p_user_id: scratchId,
        p_role: "admin",
        p_client_id: clients.a,
      });
      expect(promoted.role).toBe("admin");
      expect(promoted.client_id).toBeNull();

      // The row exists now, so a real session sees the member it belongs to.
      const directory = await callAdminRpc("admin_directory", {});
      expect(directory.map((row) => row.id)).toContain(scratchId);
      expect(directory.find((row) => row.id === scratchId)?.name).toBe(
        "Scratch Member",
      );
    });
    await adminDb().from("users").delete().eq("id", scratchId);
  });

  it("refuses to detach the last admin, and leaves the row intact", async () => {
    const { callAdminRpc } = await rpc();
    const db = adminDb();
    const before = await db.from("users").select("id").eq("role", "admin");
    expect((before.data ?? []).length).toBe(1);
    const onlyAdmin = before.data![0].id;

    await withSession(FIXTURE_USERS.admin, async () => {
      const refusal = await callAdminRpc("admin_detach_member", {
        p_user_id: onlyAdmin,
      }).catch((error: unknown) => error);
      expect((refusal as { code?: string }).code).toBe("45001");
    });

    const after = await db.from("users").select("id").eq("role", "admin");
    expect((after.data ?? []).map((row) => row.id)).toEqual([onlyAdmin]);
  });

  it("refuses to demote the last admin through attach", async () => {
    const { callAdminRpc } = await rpc();
    const db = adminDb();
    const before = await db.from("users").select("id,role").eq("role", "admin");
    const onlyAdmin = before.data![0];

    await withSession(FIXTURE_USERS.admin, async () => {
      const refusal = await callAdminRpc("admin_attach_member", {
        p_user_id: onlyAdmin.id,
        p_role: "staff",
        p_client_id: clients.a,
      }).catch((error: unknown) => error);
      expect((refusal as { code?: string }).code).toBe("45001");
    });

    const still = await db.from("users").select("role").eq("id", onlyAdmin.id);
    expect(still.data![0].role).toBe("admin");
  });

  it("answers 45002 when detach matches no row", async () => {
    const { callAdminRpc } = await rpc();
    scratchId = await scratchUser();
    await withSession(FIXTURE_USERS.admin, async () => {
      const failure = await callAdminRpc("admin_detach_member", {
        p_user_id: scratchId,
      }).catch((error: unknown) => error);
      expect((failure as { code?: string }).code).toBe("45002");
    });
  });

  it("treats an absent field in update as 'leave that column alone'", async () => {
    const { callAdminRpc } = await rpc();
    const db = adminDb();
    const created = await db
      .from("clients")
      .insert({
        name: "Partial Probe",
        domain: "partial.admin-test.local",
        is_active: true,
      })
      .select("id,name,is_active")
      .single();
    const id = created.data!.id as string;

    await withSession(FIXTURE_USERS.admin, async () => {
      const renamed = await callAdminRpc("admin_update_client", {
        p_id: id,
        p_name: "Partial Probe Renamed",
      });
      expect(renamed.name).toBe("Partial Probe Renamed");
      expect(renamed.is_active).toBe(true);

      const paused = await callAdminRpc("admin_update_client", {
        p_id: id,
        p_is_active: false,
      });
      expect(paused.is_active).toBe(false);
      expect(paused.name).toBe("Partial Probe Renamed");
    });

    await db.from("clients").delete().eq("id", id);
  });

  it("restores any row it moved, so the next file sees the fixtures as written", async () => {
    // Not a behaviour case: this one asserts the teardown contract the parallel
    // files depend on. clientA must still be a client of A after every write above.
    const db = adminDb();
    const { data } = await db
      .from("users")
      .select("role,client_id")
      .eq(
        "id",
        (
          await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
        ).data!.users.find((u) => u.email === FIXTURE_USERS.clientA)!.id,
      )
      .single();
    expect(data).toMatchObject({ role: "client", client_id: clients.a });
  });
});
