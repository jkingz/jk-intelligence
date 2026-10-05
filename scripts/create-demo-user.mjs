// Provisions the public demo account used by the "Try the demo" block on the
// login page, or, with --admin, the control-plane admin the panel needs to be
// reachable at all. Idempotent: re-runs update the `users` link instead of failing.
//
// Reads creds from DEMO_EMAIL / DEMO_PASSWORD, or ADMIN_EMAIL / ADMIN_PASSWORD
// with --admin (private env, never NEXT_PUBLIC_* — the login page receives them
// as server props), and links the account to the first active client unless
// DEMO_CLIENT_ID is set, or a "Northstar" client exists. An admin is linked with
// no client at all.
import { createClient } from "@supabase/supabase-js";

const asAdmin = process.argv.includes("--admin");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = asAdmin ? process.env.ADMIN_EMAIL : process.env.DEMO_EMAIL;
const password = asAdmin ? process.env.ADMIN_PASSWORD : process.env.DEMO_PASSWORD;
const emailName = asAdmin ? "ADMIN_EMAIL" : "DEMO_EMAIL";
const passwordName = asAdmin ? "ADMIN_PASSWORD" : "DEMO_PASSWORD";

if (!url || !serviceRole || !email || !password) {
  console.error(
    `Missing env. Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ` +
      `${emailName}, ${passwordName} in .env` +
      (asAdmin ? " (or drop --admin to use the DEMO_ pair)" : ""),
  );
  process.exit(1);
}

const supabase = createClient(url, serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// An admin has no tenant (`users_admin_has_no_tenant`), so requiring an active
// client on that path would be a lie about what the row may hold.
let client = null;
if (!asAdmin) {
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
  client =
    clients.find((c) => c.id === requested) ??
    clients.find((c) => c.name.toLowerCase().includes("northstar")) ??
    clients[0];
}

let authUserId;
const { data: existing, error: listError } = await supabase.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
});
if (listError) {
  console.error("listUsers failed:", listError.message);
  process.exit(1);
}
const current = existing?.users.find(
  (u) => u.email?.toLowerCase() === email.toLowerCase(),
);

if (asAdmin && !current && (existing?.users.length ?? 0) >= 1000) {
  // The list is one page. An address past it looks absent, and "absent" here
  // means create — which would hand a second admin to a project that already
  // has one without saying so.
  console.error(
    `Refusing to create an admin: the first 1000 auth accounts do not include ` +
      `${email}, so it may exist past page one. Provision it by id instead.`,
  );
  process.exit(1);
}

if (current) {
  authUserId = current.id;
  await supabase.auth.admin.updateUserById(current.id, {
    email,
    password,
    email_confirm: true,
    user_metadata: { name: asAdmin ? "Admin" : "Demo User" },
  });
  console.log(`Updated auth user ${authUserId} (${email}).`);
} else {
  const { data: created, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: asAdmin ? "Admin" : "Demo User" },
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
    {
      id: authUserId,
      role: asAdmin ? "admin" : "client",
      client_id: asAdmin ? null : client.id,
    },
    { onConflict: "id" },
  );

if (linkError) {
  console.error("Link users row failed:", linkError.message);
  process.exit(1);
}

console.log(
  asAdmin
    ? "Linked as an admin with no client (users_admin_has_no_tenant)."
    : `Linked to client "${client.name}" (${client.domain}).`,
);
console.log("Sign in with:");
console.log(`  email:    ${email}`);
console.log(`  password: ${password}`);
