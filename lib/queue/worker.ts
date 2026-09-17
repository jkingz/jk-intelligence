import { Worker } from "bullmq";
import { redisConnection, SYNC_QUEUE, syncJobSchema } from "./syncQueue";

const worker = new Worker(
  SYNC_QUEUE,
  async (job) => {
    const data = syncJobSchema.parse(job.data);
    return { clientId: data.clientId, status: "mock_completed" };
  },
  { connection: redisConnection(true), concurrency: 3 },
);

worker.on("error", () => console.error("sync_worker_error"));
worker.on("failed", (job) => console.error("sync_job_failed", { jobId: job?.id }));

async function shutdown() {
  await worker.close();
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
