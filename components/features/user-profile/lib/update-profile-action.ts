"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const nameSchema = z.string().trim().min(1).max(80);

export type UpdateProfileResult =
  | { status: "success"; name: string }
  | { status: "error"; message: string };

export async function updateProfileAction(input: { name: string }): Promise<UpdateProfileResult> {
  const parsed = nameSchema.safeParse(input.name);
  if (!parsed.success) {
    return { status: "error", message: "Enter a name (max 80 characters)." };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.updateUser({ data: { name: parsed.data } });
    if (error) return { status: "error", message: "Unable to update your profile. Please try again." };
    revalidatePath("/");
    revalidatePath("/profile");
    return { status: "success", name: parsed.data };
  } catch {
    return { status: "error", message: "Unable to update your profile. Please try again." };
  }
}
