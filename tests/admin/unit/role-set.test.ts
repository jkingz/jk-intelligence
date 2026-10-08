import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { MEMBER_ROLES } from "@/types/metrics";

const MIGRATIONS = "supabase/migrations";

function staffRoleMigration(): string {
  const file = readdirSync(MIGRATIONS).find((name) =>
    name.endsWith("_add_staff_role.sql"),
  );
  if (!file) throw new Error("add_staff_role migration is missing");
  return readFileSync(`${MIGRATIONS}/${file}`, "utf8");
}

describe("the member role set", () => {
  it("matches the list in users_role_check's DDL", () => {
    const ddl = staffRoleMigration();
    const match = ddl.match(/check\s*\(\s*role\s+in\s*\(([^)]*)\)/i);
    expect(match).not.toBeNull();
    const fromDdl = match![1]
      .split(",")
      .map((part) => part.trim().replace(/^'|'$/g, ""));
    expect(fromDdl.sort()).toEqual([...MEMBER_ROLES].sort());
  });

  it("is not restated inside the admin provisioning migration", () => {
    const ddl = readFileSync(
      `${MIGRATIONS}/20261005000000_admin_provisioning.sql`,
      "utf8",
    );
    // A second list is a second owner. users_role_check decides; the functions do not.
    expect(ddl).not.toMatch(/p_role\s+in\s*\(/i);
    expect(ddl).not.toMatch(/case\s+p_role/i);
  });
});
