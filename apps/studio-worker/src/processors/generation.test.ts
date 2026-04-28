import { describe, expect, it } from "vitest";
import { processGenerationJob, type GenerationProcessorDeps } from "./generation";

describe("processGenerationJob", () => {
  it("submits a task and marks it succeeded", async () => {
    const calls: string[] = [];
    const deps: GenerationProcessorDeps = {
      adapter: {
        provider: "jimeng",
        async estimate() {
          return { estimatedCostCents: 300, estimatedSeconds: 45 };
        },
        async submit() {
          calls.push("submit");
          return { providerTaskId: "jimeng_task" };
        },
        async getStatus() {
          return { status: "succeeded", resultUrl: "https://example.com/result.mp4" };
        },
        async cancel() {}
      },
      async markTaskRunning() {
        calls.push("running");
      },
      async loadGenerationTask(taskId) {
        return { id: taskId, userId: "user-1", provider: "jimeng", promptText: "生成视频", assetRefs: [] };
      },
      async loadAndDecryptCredential() {
        return { secretKey: "secret" };
      },
      async createReadonlyAssetUrls() {
        return [];
      },
      async saveProviderTaskId() {
        calls.push("provider-task");
      },
      async storeProviderResult() {
        calls.push("store-result");
        return { id: "asset-1" };
      },
      async markTaskSucceeded() {
        calls.push("succeeded");
      },
      async markTaskFailed() {
        calls.push("failed");
      }
    };

    await processGenerationJob(
      { taskId: "task-1", userId: "user-1", projectId: "project-1", provider: "jimeng", attempt: 1 },
      deps
    );

    expect(calls).toEqual(["running", "submit", "provider-task", "store-result", "succeeded"]);
  });
});
