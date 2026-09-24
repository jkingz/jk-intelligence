import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// No auth route has a theme toggle, so the shell must pin dark tokens itself —
// otherwise a visitor whose stored theme is `light` gets a light card framed by
// always-dark landing chrome. Source guard, same shape as demo-creds.test.ts.
const ROOT = resolve(__dirname, "../../..");

function read(...segments: string[]): string {
  return readFileSync(resolve(ROOT, ...segments), "utf8");
}

const shell = read(
  "components/features/email-password-auth/components/auth-page-shell.tsx",
);
const globals = read("app/globals.css");

describe("auth pages default to dark", () => {
  it("pins data-theme on both shell branches (chrome and chromeless)", () => {
    expect(shell.match(/^\s+data-theme="dark"$/gm)).toHaveLength(2);
  });

  it.each([
    "bg-background px-4 py-10 text-foreground",
    "flex-col items-center bg-background text-foreground",
  ])("re-declares text on the dark wrapper: %s", (classes) => {
    // `color` inherits as a resolved value, so body's light text leaks into any
    // descendant that sets no text color of its own.
    expect(shell).toContain(classes);
  });

  it("scopes the dark token block to any [data-theme=dark] element", () => {
    expect(globals).toMatch(/:root,\s*\[data-theme="dark"\]\s*\{/);
  });
});
