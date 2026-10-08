import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  callAdminRpc: vi.fn(),
  requireAdmin: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [],
    get: () => undefined,
    set: () => {},
    remove: () => {},
  }),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/agents/authAgent", () => ({
  requireAdmin: hoisted.requireAdmin,
}));
vi.mock("@/lib/admin/rpc", async (importActual) => {
  const actual = (await importActual()) as typeof import("@/lib/admin/rpc");
  return { ...actual, callAdminRpc: hoisted.callAdminRpc };
});

import { PATCH } from "@/app/api/admin/clients/[clientId]/route";
import { AdminRpcError } from "@/lib/admin/rpc";

const UUID = "00000000-0000-4000-8000-0000000000aa";

function request(body: unknown) {
  return new Request(`http://localhost/api/admin/clients/${UUID}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

function ctx(clientId: string) {
  return { params: Promise.resolve({ clientId }) };
}

beforeEach(() => {
  hoisted.callAdminRpc.mockReset();
  hoisted.requireAdmin.mockReset();
  hoisted.requireAdmin.mockResolvedValue({ allow: true });
});

describe("PATCH /api/admin/clients/[clientId]", () => {
  it("is 403 before reading the body", async () => {
    hoisted.requireAdmin.mockResolvedValue({ allow: false, reason: "forbidden" });
    const response = await PATCH(request({ name: "Atlas" }), ctx(UUID));
    expect(response.status).toBe(403);
    expect(hoisted.callAdminRpc).not.toHaveBeenCalled();
  });

  it("is 400 for a non-uuid param", async () => {
    const response = await PATCH(request({ name: "Atlas" }), ctx("7"));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("Invalid client id");
    expect(hoisted.callAdminRpc).not.toHaveBeenCalled();
  });

  it("is 400 for an empty body — the RPC's both-null case is unreachable from the app", async () => {
    const response = await PATCH(request({}), ctx(UUID));
    expect(response.status).toBe(400);
    expect(hoisted.callAdminRpc).not.toHaveBeenCalled();
  });

  it("passes only the keys it was given, so Postgres' defaults apply", async () => {
    hoisted.callAdminRpc.mockResolvedValue({ id: UUID, is_active: false });
    const response = await PATCH(request({ isActive: false }), ctx(UUID));
    expect(response.status).toBe(200);
    expect(hoisted.callAdminRpc).toHaveBeenCalledWith("admin_update_client", {
      p_id: UUID,
      p_is_active: false,
    });
    expect(JSON.stringify(hoisted.callAdminRpc.mock.calls[0][1])).not.toContain(
      "p_name",
    );
  });

  it("maps a vanished client to 409", async () => {
    hoisted.callAdminRpc.mockRejectedValue(
      new AdminRpcError("admin_update_client", "45002"),
    );
    const response = await PATCH(request({ name: "Atlas" }), ctx(UUID));
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe("That client no longer exists.");
  });
});
