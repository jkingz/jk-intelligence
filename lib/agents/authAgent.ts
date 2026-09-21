import "server-only";

import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const authUserSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(["admin", "client", "staff"]),
  clientId: z.string().uuid().nullable(),
});

export type AuthUser = z.infer<typeof authUserSchema>;

/** The auth subject plus the app `users` row, read in one pass. */
export type AuthSession = {
  /** Null when the account is authenticated but has no provisioned `users` row. */
  user: AuthUser | null;
  email: string | null;
  name: string | null;
  providers: string[];
};

/**
 * Single source of truth for "who is making this request".
 *
 * One `auth.getUser()` + one `users` read per call: callers that need both the
 * identity and the profile must use this rather than pairing `getUser()` with
 * `getAuthUser()`, which repeats both round trips.
 */
export async function getAuthSession(): Promise<AuthSession | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("role,client_id")
    .eq("id", data.user.id)
    .maybeSingle();

  const providers = (data.user.identities ?? [])
    .map((identity) => identity.provider)
    .filter((provider): provider is string => typeof provider === "string");

  return {
    user:
      profileError || !profile
        ? null
        : authUserSchema.parse({
            id: data.user.id,
            role: profile.role,
            clientId: profile.client_id,
          }),
    email: data.user.email ?? null,
    name:
      typeof data.user.user_metadata?.name === "string"
        ? data.user.user_metadata.name
        : null,
    providers: [...new Set(providers)],
  };
}

export async function getAuthUser(): Promise<AuthUser | null> {
  return (await getAuthSession())?.user ?? null;
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