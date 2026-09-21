import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const boundary = vi.hoisted(() => ({
  getUser: vi.fn(),
  profile: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: boundary.getUser },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: boundary.profile,
        }),
      }),
    }),
  })),
}));

import { getProfileView } from "./profile";

const USER_ID = "00000000-0000-4000-8000-000000000001";

afterEach(() => {
  boundary.getUser.mockReset();
  boundary.profile.mockReset();
});

describe("getProfileView", () => {
  it("returns the authenticated identity with role and client", async () => {
    boundary.getUser.mockResolvedValue({
      data: {
        user: {
          id: USER_ID,
          email: "client@example.com",
          user_metadata: { name: "Casey Client" },
          identities: [{ provider: "email" }, { provider: "google" }, { provider: "email" }],
        },
      },
      error: null,
    });
    boundary.profile.mockResolvedValue({
      data: { role: "client", client_id: USER_ID },
      error: null,
    });

    await expect(getProfileView()).resolves.toEqual({
      email: "client@example.com",
      name: "Casey Client",
      role: "client",
      clientId: USER_ID,
      providers: ["email", "google"],
    });
    // One auth round trip for identity + profile, not one per consumer.
    expect(boundary.getUser).toHaveBeenCalledTimes(1);
    expect(boundary.profile).toHaveBeenCalledTimes(1);
  });

  it("still returns the profile when no app user row is provisioned", async () => {
    boundary.getUser.mockResolvedValue({
      data: {
        user: {
          id: USER_ID,
          email: "unprovisioned@example.com",
          user_metadata: {},
          identities: [{ provider: "email" }],
        },
      },
      error: null,
    });
    boundary.profile.mockResolvedValue({ data: null, error: null });

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
    expect(boundary.profile).not.toHaveBeenCalled();
  });
});
