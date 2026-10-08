import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
const createServerSupabaseClient = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    getAll: () => [],
    get: () => undefined,
    set: () => {},
    remove: () => {},
  })),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient,
}));

import { AdminRpcError, callAdminRpc } from "@/lib/admin/rpc";

beforeEach(() => {
  rpc.mockReset();
  createServerSupabaseClient.mockReset();
  createServerSupabaseClient.mockResolvedValue({ rpc });
});

describe("callAdminRpc", () => {
  it("uses the user-scoped client and no service-role one", async () => {
    rpc.mockResolvedValue({ data: { id: "1" }, error: null });
    await callAdminRpc("admin_create_client", {
      p_name: "Atlas",
      p_domain: "atlas.example",
    });
    expect(createServerSupabaseClient).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("admin_create_client", {
      p_name: "Atlas",
      p_domain: "atlas.example",
    });
  });

  it("preserves the Postgres code on the way out", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: {
        code: "23505",
        message: "duplicate key value violates clients_domain_key",
        details: "Key (domain)=(atlas.example) already exists.",
      },
    });
    const failure = await callAdminRpc("admin_create_client", {
      p_name: "Atlas",
      p_domain: "atlas.example",
    }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AdminRpcError);
    expect((failure as AdminRpcError).code).toBe("23505");
  });

  it("does not repeat Postgres' message or its DETAIL", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: {
        code: "23505",
        message: "duplicate key …clients_domain_key",
        details: "Key (domain)=(atlas.example)",
      },
    });
    await expect(
      callAdminRpc("admin_create_client", {
        p_name: "A",
        p_domain: "a.example",
      }),
    ).rejects.toThrow(/admin rpc admin_create_client failed \(23505\)/);
    await expect(
      callAdminRpc("admin_create_client", {
        p_name: "A",
        p_domain: "a.example",
      }),
    ).rejects.not.toThrow(/clients_domain_key|DETAIL|already exists/);
  });

  it("throws a code-less error when PostgREST gives no code", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "no code here" } });
    const failure = await callAdminRpc("admin_detach_member", {
      p_user_id: "00000000-0000-4000-8000-0000000000ff",
    }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AdminRpcError);
    expect((failure as AdminRpcError).code).toBeUndefined();
  });

  it("returns data unwrapped on success", async () => {
    const row = {
      id: "00000000-0000-4000-8000-0000000000ff",
      name: "Atlas",
    };
    rpc.mockResolvedValue({ data: row, error: null });
    await expect(
      callAdminRpc("admin_create_client", {
        p_name: "Atlas",
        p_domain: "atlas.example",
      }),
    ).resolves.toEqual(row);
  });

  it("logs the function name and code, never a payload", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockResolvedValue({
      data: null,
      error: { code: "45001", message: "an admin must remain" },
    });
    await callAdminRpc("admin_attach_member", {
      p_user_id: "00000000-0000-4000-8000-0000000000ff",
      p_role: "client",
    }).catch(() => {});
    expect(spy).toHaveBeenCalledWith("[admin] rpc failed", {
      functionName: "admin_attach_member",
      code: "45001",
    });
    spy.mockRestore();
  });
});
