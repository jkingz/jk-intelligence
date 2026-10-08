import { describe, expect, it } from "vitest";

import {
  attachMemberBody,
  clientName,
  createClientBody,
  domainHost,
  updateClientBody,
} from "@/lib/admin/schemas";

describe("clientName", () => {
  it("trims and bounds the value", () => {
    expect(clientName.parse("  Atlas  ")).toBe("Atlas");
    expect(clientName.safeParse("").success).toBe(false);
    expect(clientName.safeParse("x".repeat(121)).success).toBe(false);
  });
});

describe("domainHost", () => {
  it("lowercases and keeps a bare host", () => {
    expect(domainHost.parse("  Atlas.Example/ ")).toBe("atlas.example");
  });
  it("rejects a scheme, a path, a port and a space", () => {
    for (const bad of [
      "http://atlas.example",
      "atlas.example/path",
      "atlas.example:54321",
      "not a domain",
      "at..example",
    ]) {
      const result = domainHost.safeParse(bad);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(
        "Enter a bare domain, e.g. atlas.example",
      );
    }
  });
});

describe("createClientBody", () => {
  it("requires both fields", () => {
    expect(
      createClientBody.safeParse({ name: "Atlas", domain: "atlas.example" })
        .success,
    ).toBe(true);
    expect(createClientBody.safeParse({ name: "Atlas" }).success).toBe(false);
  });
});

describe("updateClientBody", () => {
  it("demands at least one key so a no-op cannot reach the RPC", () => {
    expect(updateClientBody.safeParse({}).success).toBe(false);
    expect(updateClientBody.safeParse({ isActive: false }).success).toBe(true);
    expect(updateClientBody.safeParse({ name: "Atlas Ops" }).success).toBe(true);
  });
});

describe("attachMemberBody", () => {
  it("requires a role and takes an optional nullable client", () => {
    expect(
      attachMemberBody.safeParse({ role: "staff", clientId: null }).success,
    ).toBe(true);
    expect(attachMemberBody.safeParse({ role: "staff" }).success).toBe(true);
    expect(attachMemberBody.safeParse({ clientId: null }).success).toBe(false);
    expect(attachMemberBody.safeParse({ role: "owner" }).success).toBe(false);
  });
  it("rejects a non-uuid client id", () => {
    expect(
      attachMemberBody.safeParse({ role: "client", clientId: "7" }).success,
    ).toBe(false);
  });
});
