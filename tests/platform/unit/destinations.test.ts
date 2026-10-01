import { describe, expect, it } from "vitest";

import { resolveProxyAction } from "@/lib/auth/routing";
import {
  APP_DESTINATIONS,
  activeDestination,
} from "@/lib/navigation/destinations";

describe("activeDestination", () => {
  it("matches an exact destination", () => {
    expect(activeDestination("/connections")).toBe("/connections");
  });

  it("matches a nested route to its destination", () => {
    expect(activeDestination("/connections/detail")).toBe("/connections");
  });

  it("returns null for a path outside the rail", () => {
    expect(activeDestination("/")).toBeNull();
    expect(activeDestination("/dashboardx")).toBeNull();
  });

  it("keeps the registry flat so no href can shadow another", () => {
    // activeDestination's longest-href tie-break is unreachable while no two
    // hrefs nest. If a nested destination is added, this fails: that is the
    // moment the tie-break needs its own case.
    const hrefs = APP_DESTINATIONS.map((d) => d.href);
    for (const outer of hrefs) {
      for (const inner of hrefs) {
        expect(inner.startsWith(`${outer}/`)).toBe(false);
      }
    }
  });
});

describe("APP_DESTINATIONS", () => {
  it("renders dashboard, connections and profile in that order", () => {
    expect(APP_DESTINATIONS.map((d) => d.href)).toEqual([
      "/dashboard",
      "/connections",
      "/profile",
    ]);
  });

  it("keeps every href unique and absolute", () => {
    const hrefs = APP_DESTINATIONS.map((d) => d.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const href of hrefs) expect(href.startsWith("/")).toBe(true);
  });

  it("protects every destination it renders", () => {
    // The rail is the only place a user learns the app has a `/connections`.
    // A destination absent from PROTECTED_PREFIXES still renders, links, and
    // serves its page to an anonymous visitor — so the two lists may not drift.
    for (const { href } of APP_DESTINATIONS) {
      expect(resolveProxyAction(href, false)).toEqual({
        type: "redirect-login",
        next: href,
      });
    }
  });
});
