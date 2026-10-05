import { afterEach, describe, expect, it, vi } from "vitest";

import {
  attachMember,
  createClient,
  detachMember,
  updateClient,
} from "@/components/features/admin/lib/mutations";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

afterEach(() => fetchMock.mockReset());

describe("admin mutations", () => {
  it("shows the server's string, unchanged", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ error: "Assign another admin before removing this one." }),
        { status: 409 },
      ),
    );
    await expect(updateClient("7", { isActive: false })).resolves.toEqual({
      ok: false,
      message: "Assign another admin before removing this one.",
    });
  });

  it("falls back without interpolating the body", async () => {
    fetchMock.mockResolvedValue(new Response("<html>502</html>", { status: 502 }));
    await expect(createClient("Atlas", "atlas.example")).resolves.toEqual({
      ok: false,
      message: "The change did not save.",
    });
  });

  it("sends no body or content-type on DELETE", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    await expect(detachMember("7")).resolves.toEqual({ ok: true });
    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe("/api/admin/members/7");
    expect(init.body).toBeUndefined();
    expect(init.headers).toEqual({});
  });

  it("sends clientId null so 'Unassigned' is addressable", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    await attachMember("7", { role: "client", clientId: null });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      role: "client",
      clientId: null,
    });
  });

  it("reports a network failure as a message, not a throw", async () => {
    fetchMock.mockRejectedValue(new Error("Failed to fetch"));
    await expect(updateClient("7", { name: "Atlas" })).resolves.toEqual({
      ok: false,
      message: "Could not reach the server.",
    });
  });
});
