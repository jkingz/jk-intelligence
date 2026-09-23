import { describe, expect, it } from "vitest";

import {
  readDashboardTab,
  withDashboardParams,
} from "@/lib/dashboard/url-state";

const params = (search: string) => new URLSearchParams(search);

describe("readDashboardTab", () => {
  it("returns the tab named in the query", () => {
    expect(readDashboardTab("?client=abc&tab=queries")).toBe("queries");
  });

  it("falls back to overview for an unknown tab", () => {
    expect(readDashboardTab("?tab=bogus")).toBe("overview");
  });

  it("falls back to overview when no tab is present", () => {
    expect(readDashboardTab("")).toBe("overview");
  });
});

describe("withDashboardParams", () => {
  it("adds the tab without dropping client or days", () => {
    const next = params(withDashboardParams("?client=abc&days=30", { tab: "queries" }));
    expect(next.get("client")).toBe("abc");
    expect(next.get("days")).toBe("30");
    expect(next.get("tab")).toBe("queries");
  });

  it("keeps the current tab when client and days change", () => {
    const next = params(
      withDashboardParams("?client=abc&days=30&tab=queries", { client: "def", days: 90 }),
    );
    expect(next.get("client")).toBe("def");
    expect(next.get("days")).toBe("90");
    expect(next.get("tab")).toBe("queries");
  });

  it("replaces an existing tab instead of appending a duplicate", () => {
    const next = withDashboardParams("?tab=overview", { tab: "ai_visibility" });
    expect(next.match(/tab=/g)).toHaveLength(1);
    expect(params(next).get("tab")).toBe("ai_visibility");
  });

  it("returns an empty search when nothing is set", () => {
    expect(withDashboardParams("", {})).toBe("");
    expect(withDashboardParams("", { tab: "queries" })).toBe("?tab=queries");
  });
});
