import { existsSync } from "node:fs";
import path from "node:path";

// Playwright's config loader transpiles to CJS (no "type": "module" here), so
// import.meta.url is unavailable in this file's first consumer. Root-relative
// from cwd is safe because both entry points are pnpm scripts run from the repo.
const root = process.cwd();

// The `next dev`/`next start` child process loads .env files for itself, but the
// Playwright runner is a separate process, so specs see nothing unless this loads
// them here. Reverse Next's order because loadEnvFile never overrides a variable
// the shell already set: loading .env.local first lets it win over .env.
for (const file of [".env.local", ".env"]) {
  const filePath = path.resolve(root, file);
  if (existsSync(filePath)) process.loadEnvFile(filePath);
}
