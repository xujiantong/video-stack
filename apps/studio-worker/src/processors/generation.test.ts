import { describe, expect, it } from "vitest";
import { ProviderAdapterError } from "@video-stack/provider-jimeng";
import { processGenerationJob, type GenerationProcessorDeps } from "./generation";

describe("processGenerationJob", () => {
  function createDeps(overrides: Partial<GenerationProcessorDeps> = {}): GenerationProcessorDeps {
    const calls: string[] = [];
    const deps: GenerationProcessorDeps & { calls: string[] } = {
      calls,
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
        async cancel() {
          calls.push("cancel-provider");
        },
        async downloadResult() {
          calls.push("download-result");
          return new Uint8Array([1, 2, 3]);
        }
      },
      async markTaskRunning() {
        calls.push("running");
      },
      async loadGenerationTask(taskId) {
        return { id: taskId, userId: "user-1", provider: "jimeng", promptText: "生成视频", assetRefs: [], status: "queued" };
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
      async markTaskSucceeded(_taskId, _resultAssetId, actualCostCents) {
        expect(actualCostCents).toBeGreaterThanOrEqual(0);
        calls.push("succeeded");
      },
      async markTaskFailed(_taskId, code) {
        calls.push(`failed:${code}`);
      },
      async markTaskCanceled() {
        calls.push("canceled");
      },
      async waitBeforeNextPoll() {
        calls.push("wait");
      },
      maxStatusPolls: 2,
      ...overrides
    };
    return deps;
  }

  it("submits a task, downloads the result, and marks it succeeded", async () => {
    const deps = createDeps();
    await processGenerationJob(
      { taskId: "task-1", userId: "user-1", projectId: "project-1", provider: "jimeng", attempt: 1 },
      deps
    );

    expect((deps as GenerationProcessorDeps & { calls: string[] }).calls).toEqual([
      "running",
      "submit",
      "provider-task",
      "download-result",
      "store-result",
      "succeeded"
    ]);
  });

  it("marks provider failure without retrying nonretryable errors", async () => {
    const deps = createDeps({
      adapter: {
        ...createDeps().adapter,
        async getStatus() {
          return { status: "failed", errorCode: "INVALID_TASK", errorMessage: "任务编号无效" };
        }
      }
    });

    await processGenerationJob(
      { taskId: "task-1", userId: "user-1", projectId: "project-1", provider: "jimeng", attempt: 1 },
      deps
    );

    expect((deps as GenerationProcessorDeps & { calls: string[] }).calls).toContain("failed:INVALID_TASK");
  });

  it("throws retryable errors so BullMQ can retry the job", async () => {
    const deps = createDeps({
      adapter: {
        ...createDeps().adapter,
        async getStatus() {
          return { status: "failed", errorCode: "PROVIDER_RATE_LIMITED", errorMessage: "即梦限流" };
        }
      }
    });

    await expect(
      processGenerationJob({ taskId: "task-1", userId: "user-1", projectId: "project-1", provider: "jimeng", attempt: 1 }, deps)
    ).rejects.toThrow("即梦限流");
    expect((deps as GenerationProcessorDeps & { calls: string[] }).calls).toContain("failed:PROVIDER_RATE_LIMITED");
  });

  it("cancels provider work when the task is canceled during polling", async () => {
    let checks = 0;
    const deps = createDeps();
    deps.isTaskCanceled = async () => {
      checks += 1;
      return checks > 1;
    };
    deps.adapter = {
      ...deps.adapter,
      async getStatus() {
        return { status: "running" };
      }
    };

    await processGenerationJob(
      { taskId: "task-1", userId: "user-1", projectId: "project-1", provider: "jimeng", attempt: 1 },
      deps
    );

    expect((deps as GenerationProcessorDeps & { calls: string[] }).calls).toContain("cancel-provider");
    expect((deps as GenerationProcessorDeps & { calls: string[] }).calls).toContain("canceled");
  });

  it("maps retryable adapter errors before retrying", async () => {
    const deps = createDeps({
      adapter: {
        ...createDeps().adapter,
        async submit() {
          throw new ProviderAdapterError({
            code: "PROVIDER_TIMEOUT",
            message: "即梦响应超时",
            retryable: true
          });
        }
      }
    });

    await expect(
      processGenerationJob({ taskId: "task-1", userId: "user-1", projectId: "project-1", provider: "jimeng", attempt: 1 }, deps)
    ).rejects.toThrow("即梦响应超时");
    expect((deps as GenerationProcessorDeps & { calls: string[] }).calls).toContain("failed:PROVIDER_TIMEOUT");
  });
});
