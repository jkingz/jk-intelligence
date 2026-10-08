import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildMemberViews, withMemberCounts } from "@/lib/admin/provisioning";

const uuid = (label: string) =>
  `00000000-0000-4000-8000-${label.padEnd(12, "0")}`;

const directory = [
  { id: uuid("aaaa"), email: "ada@example.com", name: "Ada", created_at: "2026-09-01T00:00:00Z" },
  { id: uuid("bbbb"), email: "bob@example.com", name: null, created_at: "2026-09-02T00:00:00Z" },
  { id: uuid("cccc"), email: "cara@example.com", name: "Cara", created_at: "2026-09-03T00:00:00Z" },
];

describe("buildMemberViews", () => {
  it("splits the directory into provisioned and pending by users-row presence", () => {
    // The row literal goes in as an argument, not through a local: a local widens
    // `role` to string and stops matching the inferred UserRow.
    const views = buildMemberViews(
      [
        {
          id: uuid("cccc"),
          role: "staff",
          client_id: uuid("d1d1"),
          created_at: "2026-09-04T00:00:00Z",
        },
      ],
      directory,
    );
    expect(views.provisioned.map((m) => m.userId)).toEqual([uuid("cccc")]);
    expect(views.pending.map((p) => p.userId)).toEqual([uuid("aaaa"), uuid("bbbb")]);
  });

  it("takes email and display name from the directory, never from the users row", () => {
    const views = buildMemberViews(
      [{ id: uuid("aaaa"), role: "client", client_id: null, created_at: "2026-09-05T00:00:00Z" }],
      directory,
    );
    expect(views.provisioned[0]).toMatchObject({
      email: "ada@example.com",
      name: "Ada",
      clientId: null,
      clientName: null,
      unlisted: false,
    });
  });

  it("marks a member whose auth row the directory hid", () => {
    // users.id FK-references auth.users(id), so this should be unreachable —
    // but a truncated directory (the 1000-row cap) makes it real, and the panel
    // must not render a blank row when it does.
    const views = buildMemberViews(
      [{ id: uuid("zzzz"), role: "client", client_id: null, created_at: "2026-09-06T00:00:00Z" }],
      directory,
    );
    expect(views.provisioned).toHaveLength(1);
    expect(views.provisioned[0]).toMatchObject({ unlisted: true, email: null, name: null });
  });

  it("keeps pending accounts in signup order", () => {
    const views = buildMemberViews([], [directory[2], directory[0], directory[1]]);
    expect(views.pending.map((p) => p.email)).toEqual([
      "ada@example.com",
      "bob@example.com",
      "cara@example.com",
    ]);
  });

  it("sorts provisioned members by their users-row creation time", () => {
    const views = buildMemberViews(
      [
        { id: uuid("cccc"), role: "admin", client_id: null, created_at: "2026-09-09T00:00:00Z" },
        { id: uuid("aaaa"), role: "client", client_id: null, created_at: "2026-09-07T00:00:00Z" },
      ],
      directory,
    );
    expect(views.provisioned.map((m) => m.userId)).toEqual([uuid("aaaa"), uuid("cccc")]);
  });
});

describe("withMemberCounts", () => {
  it("groups provisioned members by client in one pass", () => {
    const clients = [
      { id: uuid("d1d1"), name: "Atlas", domain: "atlas.example", is_active: true },
      { id: uuid("d2d2"), name: "Borealis", domain: "borealis.example", is_active: false },
    ];
    const { provisioned } = buildMemberViews(
      [
        { id: uuid("aaaa"), role: "client", client_id: uuid("d1d1"), created_at: "2026-09-01T00:00:00Z" },
        { id: uuid("bbbb"), role: "staff", client_id: uuid("d1d1"), created_at: "2026-09-02T00:00:00Z" },
      ],
      directory,
    );
    const panel = withMemberCounts(clients, provisioned);
    expect(panel.map((c) => c.memberCount)).toEqual([2, 0]);
    expect(panel[1]).not.toHaveProperty("clientName");
  });

  it("maps is_active to isActive for the view model", () => {
    const panel = withMemberCounts(
      [{ id: uuid("d1d1"), name: "Atlas", domain: "atlas.example", is_active: true }],
      [],
    );
    expect(panel[0]).toEqual({
      id: uuid("d1d1"),
      name: "Atlas",
      domain: "atlas.example",
      isActive: true,
      memberCount: 0,
    });
  });
});
