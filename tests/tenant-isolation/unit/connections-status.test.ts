import { describe, expect, it } from "vitest";

import { buildConnectionStates } from "@/lib/connections/status";
import type { CredentialRow } from "@/types/connections";
import type { DashboardClient } from "@/types/dashboard";

const A: DashboardClient = {
  id: "00000000-0000-4000-8000-00000000000a",
  name: "Atlas Coffee",
  domain: "atlas.example",
  initials: "AC",
};
const B: DashboardClient = {
  id: "00000000-0000-4000-8000-00000000000b",
  name: "Borealis Bikes",
  domain: "borealis.example",
  initials: "BB",
};
const GSC = "2026-09-01T00:00:00.000Z";
const SEMRUSH = "2026-09-12T00:00:00.000Z";

const row = (over: Partial<CredentialRow>): CredentialRow => ({
  clientId: A.id,
  source: "gsc",
  linkedAt: GSC,
  ...over,
});

describe("buildConnectionStates", () => {
  it("emits one entry per client, in the caller's order", () => {
    const states = buildConnectionStates([A, B], []);
    expect(states.map((s) => s.client.id)).toEqual([A.id, B.id]);
    expect(states[0].sources).toEqual([]);
  });

  it("attaches a credential to its own client only", () => {
    const states = buildConnectionStates(
      [A, B],
      [row({}), row({ clientId: B.id, source: "semrush", linkedAt: SEMRUSH })],
    );
    expect(states[0].sources).toEqual([{ source: "gsc", linkedAt: GSC }]);
    expect(states[1].sources).toEqual([{ source: "semrush", linkedAt: SEMRUSH }]);
  });

  it("orders sources by SOURCES, not by arrival", () => {
    const states = buildConnectionStates(
      [A],
      [
        row({ source: "semrush", linkedAt: SEMRUSH }),
        row({ source: "ga4", linkedAt: GSC }),
        row({ source: "gsc", linkedAt: GSC }),
      ],
    );
    expect(states[0].sources.map((s) => s.source)).toEqual(["gsc", "ga4", "semrush"]);
  });

  it("drops a row whose client is not in the visible set", () => {
    // Defensive, not the security boundary: RLS already filtered the rows. If a
    // future read ever uses the service-role client, this is what keeps a
    // foreign row out of the render — so the case stays asserted.
    const FOREIGN = "00000000-0000-4000-8000-00000000000f";
    expect(buildConnectionStates([A], [row({ clientId: FOREIGN })])[0].sources).toEqual([]);
  });

  it("keeps the earliest linkedAt when a source somehow appears twice", () => {
    const states = buildConnectionStates(
      [A],
      [
        row({ linkedAt: SEMRUSH }),
        row({ source: "gsc", linkedAt: GSC }),
      ],
    );
    expect(states[0].sources).toEqual([{ source: "gsc", linkedAt: GSC }]);
  });
});
