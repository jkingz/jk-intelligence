import { beforeEach, describe, expect, it, vi } from "vitest";
import { signOutAction } from "./sign-out-action";

const { signOut, createClient, redirect } = vi.hoisted(() => ({
  signOut: vi.fn(),
  createClient: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: createClient }));
vi.mock("next/navigation", () => ({ redirect }));

beforeEach(() => {
  createClient.mockResolvedValue({ auth: { signOut } });
  signOut.mockResolvedValue({ error: null });
  redirect.mockImplementation(() => { throw new Error("redirect"); });
});

describe("signOutAction", () => {
  it("clears the session before redirecting to login", async () => {
    await expect(signOutAction()).rejects.toThrow("redirect");
    expect(signOut).toHaveBeenCalledOnce();
    expect(redirect).toHaveBeenCalledWith("/auth/login");
  });

  it("returns a generic error without redirecting when logout fails", async () => {
    signOut.mockResolvedValue({ error: { message: "private details" } });
    await expect(signOutAction()).resolves.toEqual({ error: "Unable to log out. Please try again." });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("handles unavailable auth configuration", async () => {
    createClient.mockRejectedValue(new Error("private configuration"));
    await expect(signOutAction()).resolves.toEqual({ error: "Unable to log out. Please try again." });
    expect(redirect).not.toHaveBeenCalled();
  });
});
