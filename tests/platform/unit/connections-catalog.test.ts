import { describe, expect, it } from "vitest";

import {
  SUPPORTED_SOURCES,
  UPCOMING_PROVIDERS,
  connectionStatusLabel,
} from "@/components/features/connections/lib/catalog";
import { SOURCES } from "@/types/metrics";

describe("connection catalog", () => {
  it("names every metric source exactly once", () => {
    expect(SUPPORTED_SOURCES.map((s) => s.source)).toEqual([...SOURCES]);
  });

  it("never advertises an upcoming provider as supported", () => {
    // The point of the split: `api_credentials` cannot store these sources, so a
    // card that implied otherwise would be the claim the landing page just
    // retracted (progress-tracker, 2026-09-24 copy pass).
    const supported = new Set<string>(SUPPORTED_SOURCES.map((s) => s.source));
    for (const upcoming of UPCOMING_PROVIDERS) {
      expect(supported.has(upcoming.id)).toBe(false);
    }
  });

  it("keeps every upcoming provider honest about why", () => {
    for (const provider of UPCOMING_PROVIDERS) {
      expect(provider.reason.length).toBeGreaterThan(20);
    }
  });

  it("labels a linked source by date and an unlinked one plainly", () => {
    expect(connectionStatusLabel("2026-09-12T00:00:00.000+00:00")).toMatch(/Linked/);
    expect(connectionStatusLabel(null)).toBe("Not connected");
  });
});
