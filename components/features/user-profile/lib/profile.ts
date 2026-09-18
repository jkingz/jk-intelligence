import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/agents/authAgent";

export interface ProfileView {
  email: string | null;
  name: string | null;
  role: "admin" | "client" | null;
  clientId: string | null;
  providers: string[];
}

export async function getProfileView(): Promise<ProfileView | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const authUser = await getAuthUser();

  const providers = (data.user.identities ?? [])
    .map((identity) => identity.provider)
    .filter((provider): provider is string => typeof provider === "string");

  return {
    email: data.user.email ?? null,
    name: typeof data.user.user_metadata?.name === "string" ? data.user.user_metadata.name : null,
    role: authUser?.role ?? null,
    clientId: authUser?.clientId ?? null,
    providers: [...new Set(providers)],
  };
}

