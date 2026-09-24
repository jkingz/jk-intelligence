import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { hasTestDb } from "../helpers/db";

// Fixtures for the tenant-isolation integration tier (test-suite spec §6):
// three auth users across two clients, provisioned idempotently via the
// service-role admin API — the mechanism already proven in
// scripts/create-demo-user.mjs.

export const FIXTURE_PASSWORD = "test-fixture-password-123";

export const CLIENT_DOMAINS = { a: "a.rls-test.local", b: "b.rls-test.local" };

export const FIXTURE_USERS = {
  clientA: "client@a.rls-test.local",
  clientB: "client@b.rls-test.local",
  staffA: "staff@a.rls-test.local",
};

export function requireTestDb(): void {
  if (!hasTestDb) {
    throw new Error(
      "[integration] .env.test is missing TEST_SUPABASE_URL — do not run fixtures",
    );
  }
  // The repository's cookie-scoped client reads the un-prefixed names at
  // runtime; bind them to the TEST stack so no call can reach the live one.
  process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.TEST_SUPABASE_URL!;
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY =
    process.env.TEST_SUPABASE_PUBLISHABLE_KEY ?? "anon-key";
}

export function adminDb(): SupabaseClient {
  return createClient(
    process.env.TEST_SUPABASE_URL!,
    process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ?? "service-role-key",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function ensureClient(db: SupabaseClient, name: string, domain: string) {
  const { data: existing } = await db
    .from("clients")
    .select("id")
    .eq("domain", domain)
    .maybeSingle();
  if (existing) return existing.id as string;
  const { data, error } = await db
    .from("clients")
    .insert({ name, domain, is_active: true })
    .select("id")
    .single();
  if (error) throw new Error(`fixture client ${domain}: ${error.message}`);
  return data.id as string;
}

async function ensureAuthUser(db: SupabaseClient, email: string) {
  const { data: existing } = await db.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const found = existing?.users.find((u) => u.email === email);
  if (found) return found.id;
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: FIXTURE_PASSWORD,
    email_confirm: true,
  });
  if (error) throw new Error(`fixture user ${email}: ${error.message}`);
  return data.user.id;
}

async function ensureLink(
  db: SupabaseClient,
  authUserId: string,
  role: "admin" | "client" | "staff",
  clientId: string | null,
) {
  const { error } = await db
    .from("users")
    .upsert(
      { id: authUserId, role, client_id: clientId },
      { onConflict: "id" },
    );
  if (error) throw new Error(`fixture link ${role}: ${error.message}`);
}

export interface TestClients {
  a: string;
  b: string;
}

/** Idempotent. Returns the two fixture client ids. */
export async function provisionFixtures(): Promise<TestClients> {
  requireTestDb();
  const db = adminDb();
  const a = await ensureClient(db, "RLS Client A", CLIENT_DOMAINS.a);
  const b = await ensureClient(db, "RLS Client B", CLIENT_DOMAINS.b);

  await ensureLink(db, await ensureAuthUser(db, FIXTURE_USERS.clientA), "client", a);
  await ensureLink(db, await ensureAuthUser(db, FIXTURE_USERS.clientB), "client", b);
  await ensureLink(db, await ensureAuthUser(db, FIXTURE_USERS.staffA), "staff", a);
  await ensureLink(
    db,
    await ensureAuthUser(db, "admin@rls-test.local"),
    "admin",
    null,
  );

  return { a, b };
}

/**
 * Binds the module graph's `cookies()` to this email's real session so
 * `createServerSupabaseClient()` (and through it the RLS-backed gate) acts
 * as that user. Pass null for the unauthenticated case.
 */
export async function withSession(
  email: string | null,
  run: () => Promise<void>,
): Promise<void> {
  const store = await buildCookieStore(email);
  currentStore = store;
  try {
    await run();
  } finally {
    currentStore = {
      getAll: () => [],
      get: () => undefined,
      set: () => {},
      remove: () => {},
    };
  }
}

export interface FakeCookieStore {
  getAll(): { name: string; value: string }[];
  get(name: string): { name: string; value: string } | undefined;
  set(cookie: { name: string; value: string }): void;
  remove(name: string): void;
}

let currentStore: FakeCookieStore = {
  getAll: () => [],
  get: () => undefined,
  set: () => {},
  remove: () => {},
};

export function getCurrentCookieStore(): FakeCookieStore {
  return currentStore;
}

async function buildCookieStore(
  email: string | null,
): Promise<FakeCookieStore> {
  const jar = new Map<string, string>();
  if (email) {
    const probe = createClient(
      process.env.TEST_SUPABASE_URL!,
      process.env.TEST_SUPABASE_PUBLISHABLE_KEY ?? "anon-key",
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data, error } = await probe.auth.signInWithPassword({
      email,
      password: FIXTURE_PASSWORD,
    });
    if (error || !data.session) {
      throw new Error(`fixture sign-in ${email}: ${error?.message ?? "no session"}`);
    }
    // @supabase/ssr derives the cookie prefix from the URL host: the first
    // label before any '.' or ':' (127.0.0.1 -> "127", demo.example -> "demo").
    const host = new URL(process.env.TEST_SUPABASE_URL!).hostname;
    jar.set(`sb-${host.split(/[.:]/)[0]}-auth-token`, JSON.stringify(data.session));
  }
  return {
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    get: (name) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (cookie) => void jar.set(cookie.name, cookie.value),
    remove: (name) => void jar.delete(name),
  };
}
