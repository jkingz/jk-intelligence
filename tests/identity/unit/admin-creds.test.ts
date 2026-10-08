import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const envExample = readFileSync(".env.example", "utf8");
const script = readFileSync("scripts/create-demo-user.mjs", "utf8");

describe("admin credentials stay server-side", () => {
  it("declares the ADMIN_ pair without a NEXT_PUBLIC_ prefix", () => {
    expect(envExample).toMatch(/^ADMIN_EMAIL=/m);
    expect(envExample).toMatch(/^ADMIN_PASSWORD=/m);
    expect(envExample).not.toMatch(/NEXT_PUBLIC_ADMIN_/);
  });

  it("never reads a NEXT_PUBLIC_ name for the admin pair in the script", () => {
    expect(script).not.toMatch(/NEXT_PUBLIC_ADMIN_/);
    expect(script).toMatch(/process\.env\.ADMIN_EMAIL/);
    expect(script).toMatch(/process\.env\.ADMIN_PASSWORD/);
  });

  it("refuses to run --admin when the account list was truncated", () => {
    expect(script).toMatch(/--admin/);
    expect(script).toMatch(/perPage:\s*1000/);
    // The guard has to compare the page size it asked for against what came back,
    // and say so out loud rather than falling through to "absent means create".
    expect(script).toMatch(/>=\s*1000/);
    expect(script).toMatch(/Refusing to create an admin/);
  });

  it("writes role only into the users row", () => {
    expect(script).toMatch(/role: asAdmin \? "admin" : "client"/);
    // tsconfig targets ES2017, so the dotAll flag is a type error; [\s\S] is the
    // same match written in a syntax the compiler accepts.
    expect(script).not.toMatch(/raw_user_meta_data[\s\S]*role/);
  });
});
