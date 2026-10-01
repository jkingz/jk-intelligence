import { describe, expect, it } from "vitest";

import {
  STATUS_UNLINKED,
  STATUS_UPCOMING,
  SUPPORTED_SOURCES,
  UPCOMING_PROVIDERS,
  connectionStatusLabel,
} from "@/components/features/connections/lib/catalog";

describe("connection catalog", () => {
  it("names every metric source exactly once", () => {
    // Pinned to the literal triple. `SUPPORTED_SOURCES` is derived from `SOURCES`, so
    // asserting one equals the other can never fail; this list is what the page shows,
    // and widening `SOURCES` has to land here before it can reach a card.
    expect(SUPPORTED_SOURCES.map((s) => s.source)).toEqual(["gsc", "ga4", "semrush"]);
  });

  it("never advertises an upcoming provider as supported", () => {
    // The point of the split: `api_credentials` cannot store these sources, so a
    // card that implied otherwise would be the claim the landing page just
    // retracted (progress-tracker, 2026-09-24 copy pass).
    // Compared on the enum spelling, not the display id: `SOURCES` would hold
    // `google_ads`, and `"google_ads" !== "google-ads"` would pass this test while
    // the catalog advertised a source the credential table can now store.
    const supported = new Set<string>(SUPPORTED_SOURCES.map((s) => s.source));
    for (const upcoming of UPCOMING_PROVIDERS) {
      expect(supported.has(upcoming.id.replace(/-/g, "_"))).toBe(false);
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

  it("owns the two status strings the row styling compares against", () => {
    // `connection-row.tsx` picks its badge variant by comparing the rendered status
    // against these exports, so the catalog must stay the only owner of them: a
    // copy edit elsewhere would restyle every row without failing a single assertion.
    expect(connectionStatusLabel(null)).toBe(STATUS_UNLINKED);
    for (const linkedAt of [
      "2020-01-01T00:00:00.000+00:00",
      "2026-09-12T00:00:00.000+00:00",
    ]) {
      expect(connectionStatusLabel(linkedAt)).not.toBe(STATUS_UPCOMING);
    }
  });
});
