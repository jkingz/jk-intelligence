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
// Partial, not wholesale: the handlers throw the real AdminRpcError, so the code
// -> status -> sentence mapping under test needs the real class.
vi.mock("@/lib/admin/rpc", async (importActual) => {
  const actual = (await importActual()) as typeof import("@/lib/admin/rpc");
  return { ...actual, callAdminRpc: hoisted.callAdminRpc };
});

import { POST } from "@/app/api/admin/clients/route";
import { AdminRpcError } from "@/lib/admin/rpc";

function request(body: unknown) {
  return new Request("http://localhost/api/admin/clients", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  hoisted.callAdminRpc.mockReset();
  hoisted.requireAdmin.mockReset();
  hoisted.requireAdmin.mockResolvedValue({ allow: true });
});

describe("POST /api/admin/clients", () => {
  it("is 403 for a signed-in non-admin, and never reaches the RPC", async () => {
    hoisted.requireAdmin.mockResolvedValue({ allow: false, reason: "forbidden" });
    const response = await POST(request({ name: "Atlas", domain: "atlas.example" }));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden" });
    expect(hoisted.callAdminRpc).not.toHaveBeenCalled();
  });

  it("is 401 with no session", async () => {
    hoisted.requireAdmin.mockResolvedValue({
      allow: false,
      reason: "unauthenticated",
    });
    const response = await POST(request({ name: "Atlas", domain: "atlas.example" }));
    expect(response.status).toBe(401);
    expect(hoisted.callAdminRpc).not.toHaveBeenCalled();
  });

  it("is 400 with zod's own message for a scheme in the domain", async () => {
    const response = await POST(
      request({ name: "Atlas", domain: "http://atlas.example" }),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe(
      "Enter a bare domain, e.g. atlas.example",
    );
    expect(hoisted.callAdminRpc).not.toHaveBeenCalled();
  });

  it("is 400 for a body that is not JSON", async () => {
    const response = await POST(request("name=Atlas"));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("Send a JSON body.");
  });

  it("echoes the row the RPC returned", async () => {
    const row = {
      id: "7",
      name: "Atlas",
      domain: "atlas.example",
      is_active: true,
      created_at: "now",
    };
    hoisted.callAdminRpc.mockResolvedValue(row);
    const response = await POST(
      request({ name: "  Atlas  ", domain: "ATLAS.example" }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ client: row });
    expect(hoisted.callAdminRpc).toHaveBeenCalledWith("admin_create_client", {
      p_name: "Atlas",
      p_domain: "atlas.example",
    });
  });

  it("maps a domain collision to 409 with the §7 string", async () => {
    hoisted.callAdminRpc.mockRejectedValue(
      new AdminRpcError("admin_create_client", "23505"),
    );
    const response = await POST(request({ name: "Atlas", domain: "atlas.example" }));
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe(
      "Another client already owns that domain.",
    );
  });

  it("maps a lost admin to 403", async () => {
    hoisted.callAdminRpc.mockRejectedValue(
      new AdminRpcError("admin_create_client", "42501"),
    );
    const response = await POST(request({ name: "Atlas", domain: "atlas.example" }));
    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe("You no longer have admin access.");
  });

  it("maps a code-less failure to 502 without leaking Postgres text", async () => {
    hoisted.callAdminRpc.mockRejectedValue(
      new AdminRpcError("admin_create_client", undefined),
    );
    const response = await POST(request({ name: "Atlas", domain: "atlas.example" }));
    expect(response.status).toBe(502);
    expect((await response.json()).error).toBe("Could not reach the database.");
  });

  it("sends no-store and Vary: Cookie on every branch", async () => {
    hoisted.callAdminRpc.mockRejectedValue(
      new AdminRpcError("admin_create_client", "45001"),
    );
    const response = await POST(request({ name: "Atlas", domain: "atlas.example" }));
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Vary")).toBe("Cookie");
  });
});
