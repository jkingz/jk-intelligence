import { Queue, type ConnectionOptions } from "bullmq";
import { z } from "zod";

export const SYNC_QUEUE = "seo-sync";
export const syncJobSchema = z.object({
  clientId: z.uuid(),
  runId: z.string().min(1).max(100),
});
export type SyncJob = z.infer<typeof syncJobSchema>;

export function redisConnection(worker = false): ConnectionOptions {
  const raw = process.env.REDIS_URL;
  if (!raw) throw new Error("REDIS_URL is required");
  const url = new URL(raw);
  if (!["redis:", "rediss:"].includes(url.protocol)) {
    throw new Error("REDIS_URL must use redis or rediss protocol");
  }
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: decodeURIComponent(url.username) || undefined,
    password: decodeURIComponent(url.password) || undefined,
    db: Number(url.pathname.slice(1) || 0),
    ...(url.protocol === "rediss:" ? { tls: {} } : {}),
    maxRetriesPerRequest: worker ? null : 1,
    connectTimeout: 5000,
    retryStrategy: worker ? (attempt: number) => Math.min(attempt * 500, 5000) : () => null,
  };
}

let queue: Queue<SyncJob> | undefined;

export function getSyncQueue() {
  if (!queue) {
    queue = new Queue<SyncJob>(SYNC_QUEUE, {
      connection: redisConnection(),
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: { age: 172800, count: 10000 },
        removeOnFail: { age: 604800, count: 10000 },
      },
    });
    queue.on("error", () => console.error("sync_queue_error"));
  }
  return queue;
}

export async function enqueueSync(input: SyncJob) {
  const data = syncJobSchema.parse(input);
  const job = await getSyncQueue().add("sync-client", data, {
    jobId: `${data.clientId}-${data.runId}`,
  });
  return job.id!;
}

export async function closeSyncQueue() {
  await queue?.close();
  queue = undefined;
}
