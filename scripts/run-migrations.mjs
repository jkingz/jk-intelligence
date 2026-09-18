import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = join(root, "supabase", "migrations");
const connectionString =
  process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  console.error(
    "SUPABASE_DB_URL (or DATABASE_URL) is not set. Add your Supabase Postgres connection string to .env.",
  );
  process.exit(1);
}

const client = new pg.Client({ connectionString });
await client.connect();

try {
  await client.query(`
    create table if not exists public.schema_migrations (
      version text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  let applied = 0;
  for (const file of files) {
    const { rows } = await client.query(
      "select 1 from public.schema_migrations where version = $1",
      [file],
    );
    if (rows.length > 0) {
      console.log(`skip    ${file}`);
      continue;
    }

    const sql = readFileSync(join(migrationsDir, file), "utf8");
    console.log(`apply   ${file}`);
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query(
        "insert into public.schema_migrations (version) values ($1)",
        [file],
      );
      await client.query("commit");
      applied += 1;
    } catch (error) {
      await client.query("rollback");
      console.error(`failed  ${file}`);
      throw error;
    }
  }

  console.log(
    applied === 0
      ? "No pending migrations."
      : `Applied ${applied} migration(s).`,
  );
} finally {
  await client.end();
}