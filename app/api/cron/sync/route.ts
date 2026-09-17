import { timingSafeEqual } from "node:crypto";
import { enqueueSync } from "@/lib/queue/syncQueue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "Cron unavailable" }, { status: 503 });
  const actual = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const id = await enqueueSync({
      clientId: "00000000-0000-4000-8000-000000000001",
      runId: new Date().toISOString().slice(0, 10),
    });
    return Response.json({ jobs: [id] }, { status: 202 });
  } catch {
    return Response.json({ error: "Unable to enqueue sync" }, { status: 503 });
  }
}

export const GET = POST;
