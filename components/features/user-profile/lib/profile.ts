import "server-only";

import { getAuthSession } from "@/lib/agents/authAgent";
import type { MemberRole } from "@/types/metrics";

export interface ProfileView {
  email: string | null;
  name: string | null;
  role: MemberRole | null;
  clientId: string | null;
  providers: string[];
}

export async function getProfileView(): Promise<ProfileView | null> {
  const session = await getAuthSession();
  if (!session) return null;

  return {
    email: session.email,
    name: session.name,
    role: session.user?.role ?? null,
    clientId: session.user?.clientId ?? null,
    providers: session.providers,
  };
}

