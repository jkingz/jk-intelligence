import { verifyCronSecret } from "@/lib/auth/cron";
import { listActiveClients } from "@/lib/db/repository";
import { enqueueSync } from "@/lib/queue/syncQueue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Vercel cron (see `vercel.json`, `crons[0].method = "POST"`) queues one
 * BullMQ sync job per active client. Vercel attaches
 * `Authorization: Bearer <CRON_SECRET>` to the request.
 */
export async function POST(request: Request) {
  const verdict = verifyCronSecret(request, process.env.CRON_SECRET);
  if (verdict === "unavailable") {
    return Response.json({ error: "Cron unavailable" }, { status: 503 });
  }
  if (verdict === "denied") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const runId = new Date().toISOString().slice(0, 10);

  let clients: Awaited<ReturnType<typeof listActiveClients>>;
  try {
    clients = await listActiveClients();
  } catch {
    return Response.json({ error: "Unable to read active clients" }, { status: 503 });
  }

  const settled = await Promise.allSettled(
    clients.map(async (client) => {
      const jobId = await enqueueSync({ clientId: client.id, runId });
      return { clientId: client.id, jobId };
    }),
  );

  const jobs: string[] = [];
  const errors: Array<{ clientId: string; message: string }> = [];
  settled.forEach((result, index) => {
    const clientId = clients[index]?.id ?? "unknown";
    if (result.status === "fulfilled") {
      jobs.push(result.value.jobId);
    } else {
      errors.push({
        clientId,
        message: result.reason instanceof Error ? result.reason.message : "enqueue failed",
      });
    }
  });

  return Response.json({ queued: jobs.length, errors }, { status: 202 });
}