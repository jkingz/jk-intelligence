import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL("../../", import.meta.url));

if (existsSync(dir + ".env.test")) {
  // process.loadEnvFile does not override variables the shell already set,
  // which is why every name here is TEST_-prefixed: reusing SUPABASE_* would
  // silently keep pointing the tier at the development project.
  process.loadEnvFile(dir + ".env.test");
}

if (!process.env.TEST_SUPABASE_URL) {
  console.warn(
    "[integration] skipped: set TEST_SUPABASE_URL, TEST_SUPABASE_PUBLISHABLE_KEY, " +
      "TEST_SUPABASE_SERVICE_ROLE_KEY and TEST_DEMO_PASSWORD in .env.test",
  );
}
