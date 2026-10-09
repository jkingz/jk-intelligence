import { afterEach, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({ profile: vi.fn() }));

vi.mock("@/components/features/user-profile/lib/profile", () => ({
  getProfileView: boundary.profile,
}));

import { GET } from "@/app/api/auth/me/route";
import type { ProfileView } from "@/components/features/user-profile/lib/profile";

const PROFILE: ProfileView = {
  email: "ada@example.com",
  name: "Ada Admin",
  role: "admin",
  clientId: null,
  providers: ["google"],
};

const get = () => GET();

afterEach(() => {
  vi.resetAllMocks();
});

describe("GET /api/auth/me", () => {
  it("returns 401 with no profile in the body when there is no session", async () => {
    boundary.profile.mockResolvedValue(null);

    const response = await get();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns the caller's profile", async () => {
    boundary.profile.mockResolvedValue(PROFILE);

    const response = await get();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ profile: PROFILE });
  });

  it("never lets the identity response be cached", async () => {
    boundary.profile.mockResolvedValue(PROFILE);

    const headers = (await get()).headers;
    expect(headers.get("cache-control")).toBe("no-store");
    expect(headers.get("vary")).toBe("Cookie");
  });

  it("returns 503 when the identity read throws", async () => {
    boundary.profile.mockRejectedValue(new Error("connection reset"));

    const response = await get();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Database operation failed" });
  });
});
