"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export type SignOutResult = { success: true } | { success: false; error: string };

export async function signOutAction(): Promise<SignOutResult> {
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.signOut();
    if (error) return { success: false, error: "Unable to log out. Please try again." };
  } catch {
    return { success: false, error: "Unable to log out. Please try again." };
  }
  return { success: true };
}