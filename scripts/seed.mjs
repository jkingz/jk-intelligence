import { createHash } from "node:crypto";

import pg from "pg";

const DAY_MS = 86_400_000;
const SOURCES = ["gsc", "ga4", "semrush"];

const SEED_CLIENTS = [
  { name: "Northstar Studio", domain: "northstar.example", scale: 1, topic: "design", stale: false },
  { name: "Evergreen Goods", domain: "evergreen.example", scale: 1.6, topic: "sustainable", stale: false },
  { name: "Atlas Coffee", domain: "atlas.example", scale: 0.65, topic: "coffee", stale: true },
];

const KEYWORDS = {
  design: [
    "brand design studio",
    "creative agency",
    "visual identity design",
    "website design studio",
    "branding services",
    "packaging design",
    "logo design agency",
    "art direction services",
    "brand strategy consulting",
    "graphic design firm",
    "ui ux design agency",
    "rebranding services",
    "editorial design studio",
    "motion design studio",
    "brand guidelines template",
    "product design agency",
    "typography design services",
    "creative direction agency",
    "digital design studio",
    "brand identity package",
  ],
  sustainable: [
    "sustainable home goods",
    "eco friendly essentials",
    "reusable kitchen products",
    "organic cotton bedding",
    "zero waste store",
    "sustainable gifts",
    "compostable packaging",
    "plastic free living",
    "bamboo homeware",
    "recycled glassware",
    "natural cleaning products",
    "eco laundry detergent",
    "sustainable furniture",
    "biodegradable utensils",
    "fair trade home decor",
    "low waste starter kit",
    "solar powered gadgets",
    "refillable cleaning bottles",
    "organic hemp textiles",
    "eco friendly cleaning kit",
  ],
  coffee: [
    "specialty coffee beans",
    "single origin coffee",
    "coffee subscription",
    "fresh roasted coffee",
    "best espresso beans",
    "pour over coffee",
    "cold brew concentrate",
    "light roast coffee",
    "decaf coffee beans",
    "coffee gift sets",
    "whole bean coffee",
    "fair trade coffee",
    "dark roast espresso",
    "nitro cold brew",
    "home espresso machine",
    "burr coffee grinder",
    "ethiopian coffee beans",
    "colombian coffee beans",
    "oat milk latte",
    "coffee brewing guide",
  ],
};

const args = process.argv.slice(2);
const reset = args.includes("--reset");
const dryRun = args.includes("--dry-run");
const days = Number(readFlag("--days", "90"));
const endArg = readFlag("--end", null);

function readFlag(name, fallback) {
  const index = args.indexOf(name);
  return index !== -1 && args[index + 1] ? args[index + 1] : fallback;
}

if (!Number.isInteger(days) || days < 1 || days > 365) {
  console.error("--days must be an integer between 1 and 365");
  process.exit(1);
}

const end = endArg
  ? new Date(`${endArg}T00:00:00.000Z`)
  : new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);

if (Number.isNaN(end.getTime())) {
  console.error("--end must be a valid YYYY-MM-DD date");
  process.exit(1);
}

function hashSeed(value) {
  return createHash("sha256").update(value).digest().readUInt32LE(0);
}

function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function round(value) {
  return Math.max(0, Math.round(value));
}

function dateForIndex(index) {
  return new Date(end.getTime() - (days - index - 1) * DAY_MS);
}

function isoDay(date) {
  return date.toISOString().slice(0, 10);
}

function metric(overrides) {
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

function weightFor(slot) {
  return 1 / (slot + 2);
}

function baseRank(client, slot) {
  const rng = createRng(hashSeed(`${client.domain}:rank:${slot}`));
  const roll = rng();
  if (roll < 0.3) return 1 + Math.floor(rng() * 5);
  if (roll < 0.7) return 6 + Math.floor(rng() * 10);
  return 16 + Math.floor(rng() * 25);
}

function baseChange(client, slot) {
  const rng = createRng(hashSeed(`${client.domain}:change:${slot}`));
  return Math.floor(rng() * 11) - 4;
}

function searchVolume(client, slot, rng) {
  const base = 300 + Math.floor(createRng(hashSeed(`${client.domain}:volume:${slot}`))() * 9000);
  return round(base * client.scale * (0.9 + rng() * 0.2));
}

function dailyClicks(client, index, rng) {
  const base = 280 + index * 6 + Math.sin(index * 1.7) * 62 + Math.cos(index * 0.6) * 34;
  const jitter = 0.97 + rng() * 0.06;
  return round(base * client.scale * jitter);
}

function rankForSlot(client, index, slot) {
  const target = baseRank(client, slot);
  const start = target + baseChange(client, slot);
  const progress = days > 1 ? index / (days - 1) : 1;
  return Math.max(1, Math.round(start + (target - start) * progress));
}

function positionFor(rank, rng) {
  return Math.max(1, Number((rank + (rng() - 0.5) * 0.6).toFixed(1)));
}

function buildMetrics(source, client, index, rng) {
  const keywords = KEYWORDS[client.topic];
  const clicks = dailyClicks(client, index, rng);

  if (source === "ga4") {
    return [
      metric({
        clicks: round(clicks * 1.12),
        conversions: round(clicks * 0.026),
      }),
    ];
  }

  const weightTotal = keywords.reduce((sum, _, slot) => sum + weightFor(slot), 0);

  return keywords.map((keyword, slot) => {
    const rank = rankForSlot(client, index, slot);
    const position = positionFor(rank, rng);

    if (source === "semrush") {
      return metric({ position, keyword, rank, searchVolume: searchVolume(client, slot, rng) });
    }

    const keywordClicks = round((clicks * weightFor(slot)) / weightTotal);
    const impressions = round(keywordClicks * 24.6);
    return metric({
      clicks: keywordClicks,
      impressions,
      ctr: impressions > 0 ? Number(((keywordClicks / impressions) * 100).toFixed(2)) : null,
      position,
      conversions: round(keywordClicks * 0.026),
      keyword,
      rank,
      searchVolume: searchVolume(client, slot, rng),
    });
  });
}

function buildPlan() {
  return SEED_CLIENTS.map((client) => ({
    client,
    days: Array.from({ length: days }, (_, index) => {
      const date = dateForIndex(index);
      const runId = `seed-${isoDay(date)}`;
      return {
        date,
        runId,
        sources: SOURCES.map((source) => ({
          source,
          metrics: buildMetrics(
            source,
            client,
            index,
            createRng(hashSeed(`${client.domain}:${source}:${isoDay(date)}`)),
          ),
        })),
      };
    }),
  }));
}

async function upsertClient(db, client) {
  const existing = await db.query(
    "select id from public.clients where lower(domain) = lower($1)",
    [client.domain],
  );
  if (existing.rows.length > 0) {
    await db.query("update public.clients set name = $2, is_active = true where id = $1", [
      existing.rows[0].id,
      client.name,
    ]);
    return existing.rows[0].id;
  }
  const inserted = await db.query(
    "insert into public.clients (name, domain, is_active) values ($1, $2, true) returning id",
    [client.name, client.domain],
  );
  return inserted.rows[0].id;
}

async function resetSeedData(db) {
  const logs = await db.query("delete from public.sync_logs where job_id like 'seed-%'");
  const snapshots = await db.query("delete from public.metrics_snapshots where run_id like 'seed-%'");
  return { logs: logs.rowCount, snapshots: snapshots.rowCount };
}

async function seed(db, plan) {
  const summary = { clients: 0, snapshots: 0, logs: 0 };

  for (const entry of plan) {
    const clientId = await upsertClient(db, entry.client);
    summary.clients += 1;

    for (const day of entry.days) {
      const syncedAt = day.date.toISOString();
      for (const { source, metrics } of day.sources) {
        await db.query(
          "select public.persist_metrics($1::uuid, $2, $3::jsonb, $4::timestamptz, $5)",
          [clientId, source, JSON.stringify(metrics), syncedAt, day.runId],
        );
        summary.snapshots += 1;
      }
    }

    if (entry.client.stale) {
      await db.query("update public.current_metrics set is_stale = true where client_id = $1", [
        clientId,
      ]);
    }

    await db.query(
      `insert into public.sync_logs (client_id, source, stage, status, message, job_id)
       values ($1, $2, 'sync', $3, $4, $5)`,
      [
        clientId,
        "gsc",
        entry.client.stale ? "partial" : "success",
        entry.client.stale
          ? "Seed: GSC source unavailable, serving cached snapshot"
          : "Seed: GSC, GA4 and Semrush snapshots written",
        `seed-${isoDay(end)}`,
      ],
    );
    summary.logs += 1;
  }

  return summary;
}

async function main() {
  const plan = buildPlan();

  if (dryRun) {
    const sample = plan[0].days[plan[0].days.length - 1];
    console.log(
      `Dry run: ${plan.length} clients x ${days} days x ${SOURCES.length} sources ` +
        `= ${plan.length * days * SOURCES.length} snapshots`,
    );
    console.log(`End date: ${isoDay(end)}   Latest run id: ${sample.runId}`);
    console.log("Sample gsc metrics:", JSON.stringify(sample.sources[0].metrics, null, 2));
    return;
  }

  const connectionString = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    console.error(
      "SUPABASE_DB_URL (or DATABASE_URL) is not set. Add your Supabase Postgres connection string to .env.",
    );
    process.exit(1);
  }

  const db = new pg.Client({ connectionString });
  await db.connect();

  try {
    await db.query("begin");

    const removed = reset ? await resetSeedData(db) : { logs: 0, snapshots: 0 };
    const summary = await seed(db, plan);

    await db.query("commit");

    if (reset) {
      console.log(`reset   ${removed.snapshots} snapshot(s), ${removed.logs} sync log(s)`);
    }
    console.log(
      `seeded  ${summary.clients} client(s), ${summary.snapshots} snapshot(s), ${summary.logs} sync log(s)`,
    );
    console.log(`range   last ${days} day(s) ending ${isoDay(end)}`);
  } catch (error) {
    await db.query("rollback");
    console.error("Seed failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}

await main();
