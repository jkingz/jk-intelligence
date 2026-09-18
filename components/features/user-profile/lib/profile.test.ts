import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const boundary = vi.hoisted(() => ({
  getUser: vi.fn(),
  getAuthUser: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: boundary.getUser },
  })),
}));

vi.mock("@/lib/agents/authAgent", () => ({ getAuthUser: boundary.getAuthUser }));

import { getProfileView } from "./profile";

const USER_ID = "00000000-0000-4000-8000-000000000001";

afterEach(() => {
  boundary.getUser.mockReset();
  boundary.getAuthUser.mockReset();
});

describe("getProfileView", () => {
  it("returns the authenticated identity with role and client", async () => {
    boundary.getUser.mockResolvedValue({
      data: {
        user: {
          email: "client@example.com",
          user_metadata: { name: "Casey Client" },
          identities: [{ provider: "email" }, { provider: "google" }],
        },
      },
      error: null,
    });
    boundary.getAuthUser.mockResolvedValue({ id: USER_ID, role: "client", clientId: USER_ID });

    await expect(getProfileView()).resolves.toEqual({
      email: "client@example.com",
      name: "Casey Client",
      role: "client",
      clientId: USER_ID,
      providers: ["email", "google"],
    });
  });

  it("still returns the profile when no app user row is provisioned", async () => {
    boundary.getUser.mockResolvedValue({
      data: {
        user: {
          email: "unprovisioned@example.com",
          user_metadata: {},
          identities: [{ provider: "email" }],
        },
      },
      error: null,
    });
    boundary.getAuthUser.mockResolvedValue(null);

    await expect(getProfileView()).resolves.toEqual({
      email: "unprovisioned@example.com",
      name: null,
      role: null,
      clientId: null,
      providers: ["email"],
    });
  });

  it("returns null without an authenticated session", async () => {
    boundary.getUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(getProfileView()).resolves.toBeNull();
  });
});
