import { NextResponse } from "next/server";

import { getProfileView } from "@/components/features/user-profile/lib/profile";

const NO_STORE = {
  "Cache-Control": "no-store",
  Vary: "Cookie",
};

/**
 * Identity for the rail's profile block. Separate from `/api/dashboard/boot` because it has
 * to answer on every app page, while the shell itself must stay session-free — reading the
 * session there would stop `/dashboard` from prerendering.
 */
export async function GET() {
  try {
    const profile = await getProfileView();
    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
    }
    return NextResponse.json({ profile }, { headers: NO_STORE });
  } catch {
    return NextResponse.json(
      { error: "Database operation failed" },
      { status: 503, headers: NO_STORE },
    );
  }
}
