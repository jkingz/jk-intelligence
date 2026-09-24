// Provisions the public demo account used by the "Try the demo" block on the
// login page. Idempotent: re-runs update the `users` link instead of failing.
//
// Reads demo creds from DEMO_EMAIL / DEMO_PASSWORD (private env, never
// NEXT_PUBLIC_* — the login page receives them as server props),
// and links the account to the first
// active client unless DEMO_CLIENT_ID is set, or a "Northstar" client exists.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.DEMO_EMAIL;
const password = process.env.DEMO_PASSWORD;

if (!url || !serviceRole || !email || !password) {
  console.error(
    "Missing env. Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, " +
      "DEMO_EMAIL, DEMO_PASSWORD in .env",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: clients, error: clientsError } = await supabase
  .from("clients")
  .select("id,name,domain")
  .eq("is_active", true)
  .order("name");

if (clientsError || !clients || clients.length === 0) {
  console.error("No active clients found to link the demo account to.");
  process.exit(1);
}

const requested = process.env.DEMO_CLIENT_ID;
const client =
  clients.find((c) => c.id === requested) ??
  clients.find((c) => c.name.toLowerCase().includes("northstar")) ??
  clients[0];

let authUserId;
const { data: existing } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
const current = existing?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

if (current) {
  authUserId = current.id;
  await supabase.auth.admin.updateUserById(current.id, {
    email,
    password,
    email_confirm: true,
    user_metadata: { name: "Demo User" },
  });
  console.log(`Updated auth user ${authUserId} (${email}).`);
} else {
  const { data: created, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: "Demo User" },
  });
  if (error) {
    console.error("createUser failed:", error.message);
    process.exit(1);
  }
  authUserId = created.user.id;
  console.log(`Created auth user ${authUserId} (${email}).`);
}

const { error: linkError } = await supabase
  .from("users")
  .upsert(
    { id: authUserId, role: "client", client_id: client.id },
    { onConflict: "id" },
  );

if (linkError) {
  console.error("Link users row failed:", linkError.message);
  process.exit(1);
}

console.log(`Linked to client "${client.name}" (${client.domain}).`);
console.log("Sign in with:");
console.log(`  email:    ${email}`);
console.log(`  password: ${password}`);