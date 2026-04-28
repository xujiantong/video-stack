import { jimengAdapter, type VideoProviderAdapter } from "@video-stack/provider-jimeng";
import type { AssetMention } from "@video-stack/shared";

export type GenerationJobPayload = {
  taskId: string;
  userId: string;
  projectId: string;
  provider: "jimeng";
  attempt: number;
};

export type StoredGenerationTask = {
  id: string;
  userId: string;
  provider: "jimeng";
  promptText: string;
  assetRefs: AssetMention[];
};

export type GenerationProcessorDeps = {
  adapter: VideoProviderAdapter;
  markTaskRunning(taskId: string): Promise<void>;
  loadGenerationTask(taskId: string): Promise<StoredGenerationTask>;
  loadAndDecryptCredential(userId: string, provider: "jimeng"): Promise<{ secretKey: string }>;
  createReadonlyAssetUrls(assetRefs: AssetMention[]): Promise<string[]>;
  saveProviderTaskId(taskId: string, providerTaskId: string): Promise<void>;
  storeProviderResult(resultUrl: string): Promise<{ id: string }>;
  markTaskSucceeded(taskId: string, resultAssetId: string): Promise<void>;
  markTaskFailed(taskId: string, code: string, message: string): Promise<void>;
};

export async function processGenerationJob(
  payload: GenerationJobPayload,
  deps: GenerationProcessorDeps = createDefaultDeps()
): Promise<void> {
  try {
    await deps.markTaskRunning(payload.taskId);
    const task = await deps.loadGenerationTask(payload.taskId);
    const credential = await deps.loadAndDecryptCredential(task.userId, task.provider);
    const assetUrls = await deps.createReadonlyAssetUrls(task.assetRefs);
    const submitted = await deps.adapter.submit({
      secretKey: credential.secretKey,
      promptText: task.promptText,
      assetUrls
    });
    await deps.saveProviderTaskId(task.id, submitted.providerTaskId);
    const result = await deps.adapter.getStatus(submitted.providerTaskId);

    if (result.status !== "succeeded" || !result.resultUrl) {
      await deps.markTaskFailed(task.id, result.errorCode ?? "PROVIDER_FAILED", result.errorMessage ?? "生成失败");
      return;
    }

    const resultAsset = await deps.storeProviderResult(result.resultUrl);
    await deps.markTaskSucceeded(task.id, resultAsset.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "生成失败";
    await deps.markTaskFailed(payload.taskId, "WORKER_ERROR", message);
  }
}

function createDefaultDeps(): GenerationProcessorDeps {
  return {
    adapter: jimengAdapter,
    async markTaskRunning() {},
    async loadGenerationTask(taskId) {
      return { id: taskId, userId: crypto.randomUUID(), provider: "jimeng", promptText: "生成视频", assetRefs: [] };
    },
    async loadAndDecryptCredential() {
      return { secretKey: "local-dev-secret" };
    },
    async createReadonlyAssetUrls(assetRefs) {
      return assetRefs.map((asset) => `https://assets.example.com/${asset.id}`);
    },
    async saveProviderTaskId() {},
    async storeProviderResult() {
      return { id: crypto.randomUUID() };
    },
    async markTaskSucceeded() {},
    async markTaskFailed() {}
  };
}
