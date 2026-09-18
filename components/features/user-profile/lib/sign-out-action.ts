"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function signOutAction(): Promise<{ error: string }> {
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.signOut();
    if (error) return { error: "Unable to log out. Please try again." };
  } catch {
    return { error: "Unable to log out. Please try again." };
  }
  redirect("/auth/login");
}
