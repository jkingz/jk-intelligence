import { beforeEach, describe, expect, it, vi } from "vitest";
import { signOutAction } from "@/components/features/user-profile/lib/sign-out-action";

const { signOut, createClient } = vi.hoisted(() => ({
  signOut: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: createClient }));

beforeEach(() => {
  createClient.mockResolvedValue({ auth: { signOut } });
  signOut.mockResolvedValue({ error: null });
});

describe("signOutAction", () => {
  it("clears the session and reports success (client navigates to the landing page)", async () => {
    await expect(signOutAction()).resolves.toEqual({ success: true });
    expect(signOut).toHaveBeenCalledOnce();
  });

  it("returns a generic error when logout fails", async () => {
    signOut.mockResolvedValue({ error: { message: "private details" } });
    await expect(signOutAction()).resolves.toEqual({
      success: false,
      error: "Unable to log out. Please try again.",
    });
  });

  it("handles unavailable auth configuration", async () => {
    createClient.mockRejectedValue(new Error("private configuration"));
    await expect(signOutAction()).resolves.toEqual({
      success: false,
      error: "Unable to log out. Please try again.",
    });
  });
});