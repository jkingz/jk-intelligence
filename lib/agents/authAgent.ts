import "server-only";

import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const authUserSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(["admin", "client", "staff"]),
  clientId: z.string().uuid().nullable(),
});

export type AuthUser = z.infer<typeof authUserSchema>;

export async function getAuthUser(): Promise<AuthUser | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("role,client_id")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profileError || !profile) return null;

  return authUserSchema.parse({
    id: data.user.id,
    role: profile.role,
    clientId: profile.client_id,
  });
}

export type AccessDecision =
  | { allow: true }
  | { allow: false; reason: "unauthenticated" | "forbidden" };

export async function enforceClientAccess(clientId: string): Promise<AccessDecision> {
  const user = await getAuthUser();
  if (!user) return { allow: false, reason: "unauthenticated" };
  if (user.role === "admin") return { allow: true };
  return (user.role === "client" || user.role === "staff") && user.clientId === clientId
    ? { allow: true }
    : { allow: false, reason: "forbidden" };
}

export async function requireAdmin(): Promise<AccessDecision> {
  const user = await getAuthUser();
  if (!user) return { allow: false, reason: "unauthenticated" };
  return user.role === "admin" ? { allow: true } : { allow: false, reason: "forbidden" };
}