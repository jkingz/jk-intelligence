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

import { DELETE, PUT } from "@/app/api/admin/members/[userId]/route";
import { AdminRpcError } from "@/lib/admin/rpc";

const UUID = "00000000-0000-4000-8000-0000000000bb";

function request(body: unknown, method = "PUT") {
  return new Request(`http://localhost/api/admin/members/${UUID}`, {
    method,
    body: method === "DELETE" ? undefined : JSON.stringify(body),
  });
}

function ctx(userId: string) {
  return { params: Promise.resolve({ userId }) };
}

beforeEach(() => {
  hoisted.callAdminRpc.mockReset();
  hoisted.requireAdmin.mockReset();
  hoisted.requireAdmin.mockResolvedValue({ allow: true });
});

describe("PUT /api/admin/members/[userId]", () => {
  it("is 403 for a non-admin before any RPC", async () => {
    hoisted.requireAdmin.mockResolvedValue({ allow: false, reason: "forbidden" });
    const response = await PUT(request({ role: "staff" }), ctx(UUID));
    expect(response.status).toBe(403);
    expect(hoisted.callAdminRpc).not.toHaveBeenCalled();
  });

  it("is 400 for an unknown role", async () => {
    const response = await PUT(request({ role: "owner" }), ctx(UUID));
    expect(response.status).toBe(400);
    expect(hoisted.callAdminRpc).not.toHaveBeenCalled();
  });

  it("is 400 for a non-uuid path param", async () => {
    const response = await PUT(request({ role: "staff" }), ctx("nope"));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("Invalid user id");
  });

  it("sends an explicit null client so 'Unassigned' is expressible", async () => {
    hoisted.callAdminRpc.mockResolvedValue({
      id: UUID,
      role: "client",
      client_id: null,
    });
    await PUT(request({ role: "client", clientId: null }), ctx(UUID));
    expect(hoisted.callAdminRpc).toHaveBeenCalledWith("admin_attach_member", {
      p_user_id: UUID,
      p_role: "client",
      p_client_id: null,
    });
  });

  it("omits the key entirely when the body omitted it", async () => {
    hoisted.callAdminRpc.mockResolvedValue({
      id: UUID,
      role: "admin",
      client_id: null,
    });
    await PUT(request({ role: "admin" }), ctx(UUID));
    expect(JSON.stringify(hoisted.callAdminRpc.mock.calls[0][1])).not.toContain(
      "p_client_id",
    );
  });

  it("maps the last-admin refusal to 409", async () => {
    hoisted.callAdminRpc.mockRejectedValue(
      new AdminRpcError("admin_attach_member", "45001"),
    );
    const response = await PUT(request({ role: "staff" }), ctx(UUID));
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe(
      "Assign another admin before removing this one.",
    );
  });
});

describe("DELETE /api/admin/members/[userId]", () => {
  it("detaches and echoes the removed row", async () => {
    hoisted.callAdminRpc.mockResolvedValue({
      id: UUID,
      role: "staff",
      client_id: null,
    });
    const response = await DELETE(request(undefined, "DELETE"), ctx(UUID));
    expect(response.status).toBe(200);
    expect((await response.json()).member).toMatchObject({ id: UUID });
    expect(hoisted.callAdminRpc).toHaveBeenCalledWith("admin_detach_member", {
      p_user_id: UUID,
    });
  });

  it("maps 'already detached' to 409", async () => {
    hoisted.callAdminRpc.mockRejectedValue(
      new AdminRpcError("admin_detach_member", "45002"),
    );
    const response = await DELETE(request(undefined, "DELETE"), ctx(UUID));
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe("That account is not provisioned.");
  });

  it("is 403 for a non-admin", async () => {
    hoisted.requireAdmin.mockResolvedValue({ allow: false, reason: "forbidden" });
    const response = await DELETE(request(undefined, "DELETE"), ctx(UUID));
    expect(response.status).toBe(403);
    expect(hoisted.callAdminRpc).not.toHaveBeenCalled();
  });
});
