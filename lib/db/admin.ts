import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

let adminDb: SupabaseClient<Database> | undefined;

export function getAdminDb(): SupabaseClient<Database> {
  if (adminDb) return adminDb;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Database configuration unavailable");
  }

  try {
    adminDb = createClient<Database>(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
    return adminDb;
  } catch {
    throw new Error("Database configuration unavailable");
  }
}
