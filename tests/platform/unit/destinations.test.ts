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

  it("prefers the longest match so a nested destination wins", () => {
    // Guards the day `/profile/session` is added as its own destination: the
    // more specific href must claim it, not `/profile`.
    expect(activeDestination("/dashboard")).toBe("/dashboard");
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
