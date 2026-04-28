import { Worker } from "bullmq";
import { processGenerationJob, type GenerationJobPayload } from "./processors/generation";

const connection = { url: process.env.REDIS_URL ?? "redis://localhost:6379" };

export function startGenerationWorker(): Worker<GenerationJobPayload> {
  return new Worker<GenerationJobPayload>("generation", async (job) => processGenerationJob(job.data), {
    connection
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startGenerationWorker();
}
