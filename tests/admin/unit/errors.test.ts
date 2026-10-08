import { describe, expect, it } from "vitest";

import { adminErrorMessage, adminErrorStatus } from "@/lib/admin/errors";

describe("adminErrorStatus", () => {
  it.each([
    ["23505", 409],
    ["23503", 409],
    ["45001", 409],
    ["45002", 409],
    ["42501", 403],
    ["23514", 500],
    ["08006", 502],
    [undefined, 502],
  ])("maps %s to %i", (code, expected) => {
    expect(adminErrorStatus(code)).toBe(expected);
  });
});

describe("adminErrorMessage", () => {
  it("names the rule, not the constraint", () => {
    expect(adminErrorMessage("admin_create_client", "23505")).toBe(
      "Another client already owns that domain.",
    );
    expect(adminErrorMessage("admin_attach_member", "45001")).toBe(
      "Assign another admin before removing this one.",
    );
    expect(adminErrorMessage("admin_detach_member", "45002")).toBe(
      "That account is not provisioned.",
    );
    expect(adminErrorMessage("admin_update_client", "45002")).toBe(
      "That client no longer exists.",
    );
    expect(adminErrorMessage("admin_attach_member", "23503")).toBe(
      "That account or client no longer exists.",
    );
    expect(adminErrorMessage("admin_create_client", "23514")).toBe(
      "The server rejected that change.",
    );
  });
  it("says the same thing for every caller who lost admin", () => {
    for (const rpc of [
      "admin_create_client",
      "admin_update_client",
      "admin_attach_member",
      "admin_detach_member",
    ] as const) {
      expect(adminErrorMessage(rpc, "42501")).toBe(
        "You no longer have admin access.",
      );
    }
  });
  it("never invents a message for an unknown code", () => {
    expect(adminErrorMessage("admin_create_client", "08006")).toBe(
      "Could not reach the database.",
    );
  });
});
