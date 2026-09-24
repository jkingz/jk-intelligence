import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Q4 guard: demo credentials must reach the browser only as server props on
// the auth pages — a NEXT_PUBLIC_DEMO_* reference anywhere below app/ and
// components/ puts the password back into the client bundle.
const ROOT = resolve(__dirname, "../../..");

function read(...segments: string[]): string {
  return readFileSync(resolve(ROOT, ...segments), "utf8");
}

describe("demo credential exposure", () => {
  const clientModules = [
    "components/features/email-password-auth/components/demo-access.tsx",
    "components/features/email-password-auth/components/auth-flow.tsx",
    "app/auth/login/page.tsx",
    "app/auth/sign-up/page.tsx",
  ];

  it.each(clientModules)(
    "%s carries no NEXT_PUBLIC_DEMO reference",
    (path) => {
      expect(read(path)).not.toMatch(/NEXT_PUBLIC_DEMO/);
    },
  );

  it("DemoAccess receives creds as props, not env", () => {
    const src = read(
      "components/features/email-password-auth/components/demo-access.tsx",
    );
    expect(src).toMatch(/email\?:\s*string/);
    expect(src).toMatch(/password\?:\s*string/);
    expect(src).not.toMatch(/process\.env/);
  });

  it("auth pages read the private env server-side", () => {
    for (const path of ["app/auth/login/page.tsx", "app/auth/sign-up/page.tsx"]) {
      const src = read(path);
      expect(src).toMatch(/process\.env\.DEMO_EMAIL/);
      expect(src).toMatch(/process\.env\.DEMO_PASSWORD/);
    }
  });
});
