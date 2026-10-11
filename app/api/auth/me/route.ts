import { getProfileView } from "@/components/features/user-profile/lib/profile";
import { gateNullable, json } from "@/lib/api/guard";

/**
 * Identity for the rail's profile block. Separate from `/api/dashboard/boot` because it has
 * to answer on every app page, while the shell itself must stay session-free — reading the
 * session there would stop `/dashboard` from prerendering.
 */
export async function GET() {
  const gate = await gateNullable(getProfileView);
  if (!gate.allow) return gate.response;
  return json({ profile: gate.value }, 200);
}
