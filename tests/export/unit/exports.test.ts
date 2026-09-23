import { describe, expect, it } from "vitest";

import {
  buildOverview,
  toDashboardClient,
  type MetricSnapshotInput,
} from "@/lib/dashboard/overview";
import type { NormalizedMetric, Source } from "@/types/metrics";
import { buildExportDataset } from "@/lib/exports/dataset";
import { CSV_HEADERS, toCsv } from "@/lib/exports/csv";
import { exportFilename } from "@/lib/exports/filename";
import { renderPdfReport, reportText } from "@/lib/exports/pdf";

function metric(overrides: Partial<NormalizedMetric>): NormalizedMetric {
  return {
    clicks: null,
    impressions: null,
    ctr: null,
    position: null,
    conversions: null,
    keyword: null,
    rank: null,
    searchVolume: null,
    ...overrides,
  };
}

function snapshot(day: string, source: Source, metrics: NormalizedMetric[]): MetricSnapshotInput {
  return { source, metrics, syncedAt: `${day}T00:00:00.000Z` };
}

const client = toDashboardClient({
  id: "c1",
  name: "Northstar Studio",
  domain: "northstar.example",
});

const NOW = new Date("2026-09-18T00:00:00.000Z");
const DAYS = Array.from({ length: 14 }, (_, index) =>
  new Date(Date.UTC(2026, 8, 4) + index * 86_400_000).toISOString().slice(0, 10),
);

function snapshots(): MetricSnapshotInput[] {
  const rows: MetricSnapshotInput[] = [];
  DAYS.forEach((day, index) => {
    rows.push(
      snapshot(day, "gsc", [
        metric({
          clicks: 100 + index,
          impressions: (100 + index) * 10,
          position: 10,
          conversions: 1,
          keyword: "alpha",
          rank: 14 - index,
          searchVolume: 1000,
        }),
      ]),
    );
    rows.push(snapshot(day, "semrush", [metric({ clicks: 5, keyword: "=cmd|'x'!A0" })]));
  });
  return rows;
}

describe("buildExportDataset", () => {
  const dataset = buildExportDataset({ client, days: 7, snapshots: snapshots(), now: NOW });

  it("scans the selected window across all sources", () => {
    expect(dataset.range).toMatchObject({ from: "2026-09-11", to: "2026-09-17" });
    expect(dataset.metrics).toHaveLength(14);
    expect(new Set(dataset.metrics.map((row) => row.source))).toEqual(
      new Set(["gsc", "semrush"]),
    );
    expect(dataset.metrics.every((row) => row.date >= "2026-09-11")).toBe(true);
  });

  it("matches the dashboard summary via buildOverview", () => {
    const overview = buildOverview({
      client,
      days: 7,
      snapshots: snapshots().filter((row) => row.source === "gsc"),
      stale: false,
      now: NOW,
    })!;
    expect(dataset.summary[0]).toEqual({
      label: "Total clicks",
      value: overview.clicks.toLocaleString("en-US"),
      delta: expect.any(String),
    });
    expect(dataset.keywords).toEqual(overview.keywords);
  });

  it("aggregates per-source totals", () => {
    const gsc = dataset.sourceTotals.find((total) => total.source === "gsc");
    const semrush = dataset.sourceTotals.find((total) => total.source === "semrush");
    expect(gsc).toMatchObject({ records: 7, clicks: 770, conversions: 7 });
    expect(semrush).toMatchObject({ records: 7, clicks: 35, impressions: 0 });
    expect(semrush!.averagePosition).toBeNull();
  });

  it("renders zeroed summary rows when no data exists", () => {
    const empty = buildExportDataset({ client, days: 7, snapshots: [], now: NOW });
    expect(empty.summary[0]!.value).toBe("0");
    expect(empty.summary.every((row) => row.delta === null)).toBe(true);
    expect(empty.metrics).toEqual([]);
  });

  it("anchors every section on the newest GSC snapshot", () => {
    // A Semrush-only sync landed two days after the last GSC day.
    const late = snapshots().concat(
      snapshot("2026-09-19", "semrush", [metric({ clicks: 9, keyword: "late" })]),
    );
    const dataset = buildExportDataset({ client, days: 7, snapshots: late, now: NOW });

    expect(dataset.range).toMatchObject({ from: "2026-09-11", to: "2026-09-17" });
    expect(dataset.metrics.some((row) => row.date === "2026-09-19")).toBe(false);
    const overview = buildOverview({
      client,
      days: 7,
      snapshots: late.filter((row) => row.source === "gsc"),
      stale: false,
      now: NOW,
    })!;
    expect(dataset.keywords).toEqual(overview.keywords);
  });

  it("falls back to the newest snapshot of any source without gsc data", () => {
    const onlySemrush = snapshots().filter((row) => row.source === "semrush");
    const dataset = buildExportDataset({
      client,
      days: 7,
      snapshots: onlySemrush,
      now: NOW,
    });
    expect(dataset.range.to).toBe("2026-09-17");
    expect(dataset.metrics.every((row) => row.source === "semrush")).toBe(true);
  });
});

describe("toCsv", () => {
  const dataset = buildExportDataset({ client, days: 7, snapshots: snapshots(), now: NOW });
  const csv = toCsv(dataset);
  const lines = csv.replace(/^﻿/, "").trimEnd().split("\r\n");

  it("emits BOM + header + one row per metric, RFC 4180 CRLF", () => {
    expect(csv.startsWith("﻿")).toBe(true);
    expect(lines[0]).toBe(CSV_HEADERS.join(","));
    expect(lines).toHaveLength(15);
  });

  it("neutralizes spreadsheet formula injection", () => {
    expect(csv).toContain("'=cmd|'x'!A0");
  });

  it("neutralizes formulas hidden behind leading whitespace or control characters", () => {
    const keywords = ["  =cmd|'x'!A0", "\t@SUM(1,2)", " \u001B+1+1", "\u0000-cmd"];
    for (const keyword of keywords) {
      const csv = toCsv({
        ...dataset,
        metrics: [{ ...dataset.metrics[0]!, keyword }],
      });
      // The guard prefixes the cell without dropping the padding it hides behind.
      expect(csv).toContain(`'${keyword}`);
    }
    // Ordinary prose is left alone.
    expect(
      toCsv({ ...dataset, metrics: [{ ...dataset.metrics[0]!, keyword: "north star" }] }),
    ).not.toContain("'north star");
  });

  it("quotes cells containing commas or quotes", () => {
    const row = toCsv({
      ...dataset,
      metrics: [
        { ...dataset.metrics[0]!, keyword: 'say "hi", ok' },
      ],
    });
    expect(row).toContain('"say ""hi"", ok"');
  });

  it("renders null cells as empty", () => {
    const row = toCsv({
      ...dataset,
      metrics: [{ ...dataset.metrics[0]!, searchVolume: null }],
    });
    expect(row.trimEnd().split("\r\n")[1]!.endsWith(",")).toBe(true);
  });
});

describe("exportFilename", () => {
  it("slugs the client name and stamps the UTC date", () => {
    expect(exportFilename("Northstar Studio!!", 30, "metrics", NOW)).toBe(
      "northstar-studio-metrics-30d-2026-09-18.csv",
    );
    expect(exportFilename("../../etc/passwd", 7, "report", NOW)).toBe(
      "etc-passwd-report-7d-2026-09-18.pdf",
    );
    expect(exportFilename("???", 90, "report", NOW)).toBe(
      "client-report-90d-2026-09-18.pdf",
    );
  });
});

describe("renderPdfReport", () => {
  it("produces a valid multi-section PDF", async () => {
    const dataset = buildExportDataset({ client, days: 7, snapshots: snapshots(), now: NOW });
    const bytes = await renderPdfReport(dataset);
    const header = new TextDecoder().decode(bytes.slice(0, 5));
    expect(header).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it("keeps non-Latin client text instead of blanking it out", () => {
    // The WinAnsi standard fonts mangled every one of these into a space.
    expect(reportText("München Ñoño Москва Kraków")).toBe("München Ñoño Москва Kraków");
    expect(reportText("seo–report · über uns")).toBe("seo–report · über uns");
    expect(reportText("tab\tnul\u0000esc\u001B")).toBe("tab nul esc ");
  });

  it("renders a report whose client name and keywords are non-Latin", async () => {
    const dataset = buildExportDataset({
      client: toDashboardClient({ id: "c1", name: "München Analyse", domain: "münchen.example" }),
      days: 7,
      snapshots: [
        snapshot("2026-09-17", "gsc", [
          metric({ clicks: 3, keyword: "über uns", rank: 2, searchVolume: 40, position: 2 }),
        ]),
      ],
      now: NOW,
    });
    const bytes = await renderPdfReport(dataset);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });

  it("tolerates an empty dataset", async () => {
    const empty = buildExportDataset({ client, days: 7, snapshots: [], now: NOW });
    const bytes = await renderPdfReport(empty);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });
});
