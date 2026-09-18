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

import { enforceClientAccess, getAuthUser, requireAdmin } from "./authAgent";

const ADMIN = "00000000-0000-4000-8000-000000000002";
const CLIENT = "00000000-0000-4000-8000-000000000001";
const OTHER_CLIENT = "00000000-0000-4000-8000-00000000000b";

afterEach(() => {
  boundary.getUser.mockReset();
  boundary.profile.mockReset();
});

describe("getAuthUser", () => {
  it("returns the profile for an authenticated session", async () => {
    boundary.getUser.mockResolvedValue({ data: { user: { id: CLIENT } }, error: null });
    boundary.profile.mockResolvedValue({
      data: { role: "client", client_id: OTHER_CLIENT },
      error: null,
    });

    await expect(getAuthUser()).resolves.toEqual({
      id: CLIENT,
      role: "client",
      clientId: OTHER_CLIENT,
    });
  });

  it("returns null when there is no session", async () => {
    boundary.getUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(getAuthUser()).resolves.toBeNull();
  });

  it("returns null when the user has no profile row", async () => {
    boundary.getUser.mockResolvedValue({ data: { user: { id: CLIENT } }, error: null });
    boundary.profile.mockResolvedValue({ data: null, error: null });

    await expect(getAuthUser()).resolves.toBeNull();
  });
});

describe("enforceClientAccess", () => {
  it("grants admins access to any client", async () => {
    boundary.getUser.mockResolvedValue({ data: { user: { id: ADMIN } }, error: null });
    boundary.profile.mockResolvedValue({
      data: { role: "admin", client_id: null },
      error: null,
    });

    await expect(enforceClientAccess(OTHER_CLIENT)).resolves.toEqual({ allow: true });
  });

  it("grants clients access to their own data", async () => {
    boundary.getUser.mockResolvedValue({ data: { user: { id: CLIENT } }, error: null });
    boundary.profile.mockResolvedValue({
      data: { role: "client", client_id: OTHER_CLIENT },
      error: null,
    });

    await expect(enforceClientAccess(OTHER_CLIENT)).resolves.toEqual({ allow: true });
  });

  it("denies clients access to another client's data", async () => {
    boundary.getUser.mockResolvedValue({ data: { user: { id: CLIENT } }, error: null });
    boundary.profile.mockResolvedValue({
      data: { role: "client", client_id: OTHER_CLIENT },
      error: null,
    });

    await expect(enforceClientAccess(CLIENT)).resolves.toEqual({
      allow: false,
      reason: "forbidden",
    });
  });

  it("denies unauthenticated requests", async () => {
    boundary.getUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(enforceClientAccess(OTHER_CLIENT)).resolves.toEqual({
      allow: false,
      reason: "unauthenticated",
    });
  });
});

describe("requireAdmin", () => {
  it("allows admin users", async () => {
    boundary.getUser.mockResolvedValue({ data: { user: { id: ADMIN } }, error: null });
    boundary.profile.mockResolvedValue({
      data: { role: "admin", client_id: null },
      error: null,
    });

    await expect(requireAdmin()).resolves.toEqual({ allow: true });
  });

  it("forbids clients", async () => {
    boundary.getUser.mockResolvedValue({ data: { user: { id: CLIENT } }, error: null });
    boundary.profile.mockResolvedValue({
      data: { role: "client", client_id: OTHER_CLIENT },
      error: null,
    });

    await expect(requireAdmin()).resolves.toEqual({
      allow: false,
      reason: "forbidden",
    });
  });
});