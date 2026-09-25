import pg from "pg";

// Seeds demo api_credentials rows so /connections has something to render.
// Writes a syntactically valid, obviously fake Vault reference: nothing in this
// app decrypts or uses it, and the credential_reference check constraint is the
// only thing it must satisfy. Never prints the reference (RULES.md section 16).

const args = new Set(process.argv.slice(2));
const reset = args.has("--reset");
const dryRun = args.has("--dry-run");

const CLIENTS = [
  { domain: "northstar.example", sources: ["gsc", "ga4", "semrush"] },
  { domain: "evergreen.example", sources: ["gsc"] },
  { domain: "atlas.example", sources: [] },
];

const PLACEHOLDER_REF = "vault:00000000-0000-4000-8000-00000000d00d";

if (dryRun) {
  let planned = 0;
  for (const client of CLIENTS) planned += client.sources.length;
  console.log(`[seed-connections] dry run: ${planned} rows across ${CLIENTS.length} clients`);
  for (const client of CLIENTS) {
    console.log(`  ${client.domain}: ${client.sources.join(", ") || "(none)"}`);
  }
  process.exit(0);
}

const connectionString = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  console.error("[seed-connections] SUPABASE_DB_URL is not set");
  process.exit(1);
}

const client = new pg.Client({ connectionString });
await client.connect();

try {
  if (reset) {
    const { rowCount } = await client.query(
      "delete from public.api_credentials where credential_reference = $1",
      [PLACEHOLDER_REF],
    );
    console.log(`[seed-connections] removed ${rowCount} placeholder row(s)`);
  }

  let inserted = 0;
  for (const spec of CLIENTS) {
    const found = await client.query(
      "select id from public.clients where domain = $1",
      [spec.domain],
    );
    if (found.rowCount === 0) {
      console.warn(`[seed-connections] no client for ${spec.domain} — run pnpm db:seed first`);
      continue;
    }
    for (const source of spec.sources) {
      const { rowCount } = await client.query(
        `insert into public.api_credentials (client_id, source, credential_reference)
         values ($1, $2, $3)
         on conflict (client_id, source) do nothing`,
        [found.rows[0].id, source, PLACEHOLDER_REF],
      );
      inserted += rowCount;
    }
  }
  console.log(`[seed-connections] inserted ${inserted} row(s)`);
} finally {
  await client.end();
}
