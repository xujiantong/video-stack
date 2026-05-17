import {
  jimengAdapter,
  ProviderAdapterError,
  type JimengCredential,
  type ProviderTaskStatus,
  type SubmitGenerationInput,
  type VideoProviderAdapter
} from "@video-stack/provider-jimeng";
import { isRetryableErrorCode, type AssetMention, type ErrorCode, type GenerationParameters } from "@video-stack/shared";

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
  parameters?: GenerationParameters | null;
  assetRefs: AssetMention[];
  status?: "queued" | "running" | "succeeded" | "failed" | "canceled";
};

export type GenerationProcessorDeps = {
  adapter: VideoProviderAdapter;
  markTaskRunning(taskId: string): Promise<void>;
  loadGenerationTask(taskId: string): Promise<StoredGenerationTask>;
  loadAndDecryptCredential(userId: string, provider: "jimeng"): Promise<JimengCredential>;
  createReadonlyAssetUrls(assetRefs: AssetMention[]): Promise<string[]>;
  saveProviderTaskId(taskId: string, providerTaskId: string): Promise<void>;
  isTaskCanceled?(taskId: string): Promise<boolean>;
  storeProviderResult(input: { providerTaskId: string; bytes: Uint8Array; resultUrl: string; mimeType: "video/mp4" }): Promise<{ id: string }>;
  markTaskSucceeded(taskId: string, resultAssetId: string, actualCostCents: number): Promise<void>;
  markTaskFailed(taskId: string, code: ErrorCode, message: string): Promise<void>;
  markTaskCanceled?(taskId: string): Promise<void>;
  waitBeforeNextPoll?(attempt: number): Promise<void>;
  maxStatusPolls?: number;
};

class RetryableGenerationError extends Error {}

export async function processGenerationJob(
  payload: GenerationJobPayload,
  deps: GenerationProcessorDeps = createDefaultDeps()
): Promise<void> {
  try {
    await deps.markTaskRunning(payload.taskId);
    const task = await deps.loadGenerationTask(payload.taskId);
    if (task.status === "canceled" || (await deps.isTaskCanceled?.(task.id))) {
      await deps.markTaskCanceled?.(task.id);
      return;
    }
    const credential = await deps.loadAndDecryptCredential(task.userId, task.provider);
    const assetUrls = await deps.createReadonlyAssetUrls(task.assetRefs);
    const submitInput: SubmitGenerationInput = {
      secretKey: credential.secretKey,
      promptText: task.promptText,
      assetUrls
    };
    if (credential.apiKey) submitInput.apiKey = credential.apiKey;
    if (task.parameters) submitInput.parameters = task.parameters;
    const submitted = await deps.adapter.submit(submitInput);
    await deps.saveProviderTaskId(task.id, submitted.providerTaskId);
    const result = await pollProviderStatus(submitted.providerTaskId, credential, task.id, deps);

    if (result.status === "canceled") {
      await deps.adapter.cancel(submitted.providerTaskId);
      await deps.markTaskCanceled?.(task.id);
      return;
    }

    if (result.status === "failed" || !result.resultUrl) {
      await failProviderStatus(task.id, result, deps);
      return;
    }

    const bytes = await deps.adapter.downloadResult(submitted.providerTaskId, result.resultUrl);
    const resultAsset = await deps.storeProviderResult({
      providerTaskId: submitted.providerTaskId,
      bytes,
      resultUrl: result.resultUrl,
      mimeType: "video/mp4"
    });
    await deps.markTaskSucceeded(task.id, resultAsset.id, result.actualCostCents ?? 0);
  } catch (error) {
    if (error instanceof RetryableGenerationError) throw error;
    if (error instanceof ProviderAdapterError) {
      await deps.markTaskFailed(payload.taskId, error.code, error.message);
      if (error.retryable) throw new RetryableGenerationError(error.message);
      return;
    }
    const message = error instanceof Error ? error.message : "生成失败";
    await deps.markTaskFailed(payload.taskId, "INTERNAL_ERROR", message);
  }
}

async function pollProviderStatus(
  providerTaskId: string,
  credential: JimengCredential,
  taskId: string,
  deps: GenerationProcessorDeps
): Promise<ProviderTaskStatus> {
  const maxStatusPolls = deps.maxStatusPolls ?? 3;

  for (let attempt = 1; attempt <= maxStatusPolls; attempt += 1) {
    if (await deps.isTaskCanceled?.(taskId)) return { status: "canceled" };
    const status = await deps.adapter.getStatus(providerTaskId, credential);
    if (status.status !== "running") return status;
    await deps.waitBeforeNextPoll?.(attempt);
  }

  return {
    status: "failed",
    errorCode: "PROVIDER_TIMEOUT",
    errorMessage: "即梦生成仍未完成，请稍后自动重试。"
  };
}

async function failProviderStatus(taskId: string, status: ProviderTaskStatus, deps: GenerationProcessorDeps): Promise<void> {
  const code = status.errorCode ?? "PROVIDER_FAILED";
  const message = status.errorMessage ?? "生成失败，请检查参数后重试。";
  await deps.markTaskFailed(taskId, code, message);
  if (isRetryableErrorCode(code)) {
    throw new RetryableGenerationError(message);
  }
}

function createDefaultDeps(): GenerationProcessorDeps {
  return {
    adapter: jimengAdapter,
    async markTaskRunning() {},
    async loadGenerationTask(taskId) {
      return { id: taskId, userId: crypto.randomUUID(), provider: "jimeng", promptText: "生成视频", assetRefs: [], status: "queued" };
    },
    async loadAndDecryptCredential() {
      return { apiKey: "local-dev-api-key", secretKey: "local-dev-secret" };
    },
    async createReadonlyAssetUrls(assetRefs) {
      return assetRefs.map((asset) => `https://assets.example.com/${asset.id}`);
    },
    async saveProviderTaskId() {},
    async storeProviderResult() {
      return { id: crypto.randomUUID() };
    },
    async markTaskSucceeded() {},
    async markTaskFailed() {},
    async markTaskCanceled() {},
    async waitBeforeNextPoll() {},
    maxStatusPolls: 3
  };
}
