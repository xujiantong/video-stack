import { Queue } from "bullmq";
import type { GenerationJobPayload } from "@video-stack/shared";

export type GenerationQueue = {
  enqueue(payload: GenerationJobPayload): Promise<void>;
  close?(): Promise<void>;
};

export function createBullMqGenerationQueue(redisUrl: string): GenerationQueue {
  const queue = new Queue<GenerationJobPayload>("generation", {
    connection: { url: redisUrl }
  });

  return {
    async enqueue(payload) {
      await queue.add("generation", payload, {
        attempts: 3,
        jobId: payload.taskId,
        removeOnComplete: true
      });
    },
    async close() {
      await queue.close();
    }
  };
}

export function createInMemoryGenerationQueue(): GenerationQueue & { jobs: GenerationJobPayload[] } {
  const jobs: GenerationJobPayload[] = [];
  return {
    jobs,
    async enqueue(payload) {
      jobs.push(payload);
    }
  };
}
