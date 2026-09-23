import { beforeEach, describe, expect, it, vi } from "vitest";

const { updateUser, revalidatePath } = vi.hoisted(() => ({
  updateUser: vi.fn(),
  revalidatePath: vi.fn(),
}));

const { createClient, redirect } = vi.hoisted(() => ({
  createClient: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: createClient }));
vi.mock("next/cache", () => ({ revalidatePath }));

beforeEach(() => {
  vi.resetModules();
  createClient.mockResolvedValue({ auth: { updateUser } });
  updateUser.mockResolvedValue({ error: null });
  redirect.mockImplementation(() => {});
});

describe("updateProfileAction", () => {
  async function call(name: string) {
    const { updateProfileAction } = await import("@/components/features/user-profile/lib/update-profile-action");
    return updateProfileAction({ name });
  }

  it("stores trimmed name in user metadata", async () => {
    const result = await call("  Jane Doe  ");
    expect(result).toEqual({ status: "success", name: "Jane Doe" });
    expect(updateUser).toHaveBeenCalledWith({ data: { name: "Jane Doe" } });
    expect(revalidatePath).toHaveBeenCalledWith("/");
    expect(revalidatePath).toHaveBeenCalledWith("/profile");
  });

  it("rejects blank or oversized names without touching auth", async () => {
    expect(await call("   ")).toEqual({ status: "error", message: "Enter a name (max 80 characters)." });
    expect(await call("x".repeat(81))).toEqual({ status: "error", message: "Enter a name (max 80 characters)." });
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("returns generic error when auth update fails", async () => {
    updateUser.mockResolvedValue({ error: { message: "private details" } });
    expect(await call("Jane")).toEqual({
      status: "error",
      message: "Unable to update your profile. Please try again.",
    });
  });

  it("returns generic error when configuration is unavailable", async () => {
    createClient.mockRejectedValue(new Error("private configuration"));
    expect(await call("Jane")).toEqual({
      status: "error",
      message: "Unable to update your profile. Please try again.",
    });
  });
});
