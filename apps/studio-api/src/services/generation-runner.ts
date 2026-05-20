import {
  jimengAdapter,
  ProviderAdapterError,
  type ProviderInputAsset,
  type JimengCredential,
  type ProviderTaskStatus,
  type SubmitGenerationInput,
  type VideoProviderAdapter
} from "@video-stack/provider-jimeng";
import { isImageGenerationParameters, isRetryableErrorCode, type ErrorCode, type GenerationJobPayload, type GenerationParameters } from "@video-stack/shared";
import type { StudioRepository } from "../db/repositories";
import { decryptSecret } from "../security/crypto";
import type { StorageService } from "./storage-service";

type SecretPayload = JimengCredential;

export type GenerationRunnerOptions = {
  adapter?: VideoProviderAdapter;
  pollIntervalMs?: number;
  maxStatusPolls?: number;
  repository: StudioRepository;
  secretKey: Buffer;
  storage: StorageService;
};

export function createGenerationRunner({
  adapter = jimengAdapter,
  maxStatusPolls = 90,
  pollIntervalMs = 10_000,
  repository,
  secretKey,
  storage
}: GenerationRunnerOptions) {
  return async function runGeneration(payload: GenerationJobPayload): Promise<void> {
    try {
      await repository.markGenerationTaskRunning(payload.taskId);
      const task = await repository.getGenerationTask(payload.taskId);
      if (task.status === "canceled") return;

      const credential = await loadAndDecryptCredential(repository, secretKey, task.userId, task.provider);
      const assets = await loadInputAssets(repository, storage, task.assetRefs.map((asset) => asset.id));
      const submitInput: SubmitGenerationInput = {
        secretKey: credential.secretKey,
        promptText: task.promptText,
        assetUrls: [],
        assets
      };
      if (credential.apiKey) submitInput.apiKey = credential.apiKey;
      if (task.parameters) submitInput.parameters = task.parameters;
      const submitted = await adapter.submit(submitInput);
      await repository.saveGenerationProviderTaskId(task.id, submitted.providerTaskId);

      const result = await pollProviderStatus({
        adapter,
        credential,
        maxStatusPolls,
        pollIntervalMs,
        providerTaskId: submitted.providerTaskId,
        repository,
        taskId: task.id
      });

      if (result.status === "canceled") return;
      if (result.status === "failed" || !result.resultUrl) {
        await failProviderStatus(task.id, result, repository);
        return;
      }

      const bytes = await adapter.downloadResult(submitted.providerTaskId, result.resultUrl);
      const resultMetadata = resultMetadataForTask(task.parameters, result.resultMimeType);
      const storageKey = `${task.projectId}/results/${task.id}${resultMetadata.extension}`;
      const resultBytes = Buffer.from(bytes);
      if (storage.writeObject) {
        await storage.writeObject(storageKey, resultBytes, resultMetadata.mimeType);
      } else {
        await storage.acceptLocalUpload?.(storageKey, resultBytes);
      }
      const resultAsset = await repository.createAsset({
        projectId: task.projectId,
        userId: task.userId,
        kind: resultMetadata.kind,
        mimeType: resultMetadata.mimeType,
        name: `即梦生成-${task.id}${resultMetadata.extension}`,
        sizeBytes: resultBytes.byteLength,
        tosBucket: storage.bucket,
        tosKey: storageKey,
        status: "ready"
      });
      await repository.markGenerationTaskSucceeded(task.id, resultAsset.id, result.actualCostCents ?? 0);
    } catch (error) {
      await markFailure(payload.taskId, error, repository);
    }
  };
}

function resultMetadataForTask(parameters: GenerationParameters | null | undefined, providerMimeType: string | undefined) {
  const isImage = parameters ? isImageGenerationParameters(parameters) : providerMimeType?.startsWith("image/");
  if (isImage) {
    const mimeType = providerMimeType?.startsWith("image/") ? providerMimeType : "image/jpeg";
    return {
      extension: extensionForMimeType(mimeType),
      kind: "image" as const,
      mimeType
    };
  }
  return {
    extension: ".mp4",
    kind: "video" as const,
    mimeType: "video/mp4"
  };
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";
  return ".jpg";
}

async function loadInputAssets(repository: StudioRepository, storage: StorageService, assetIds: string[]): Promise<ProviderInputAsset[]> {
  if (assetIds.length === 0) return [];
  if (!storage.readObject) {
    throw new ProviderAdapterError({
      code: "PROVIDER_FAILED",
      message: "当前存储不支持读取参考素材，请切换本地存储或对象存储读取能力。",
      retryable: false
    });
  }

  const assets: ProviderInputAsset[] = [];
  for (const assetId of assetIds) {
    const asset = await repository.getAsset(assetId);
    assets.push({
      bytes: await storage.readObject(asset.tosKey),
      kind: asset.kind,
      mimeType: asset.mimeType
    });
  }
  return assets;
}

async function loadAndDecryptCredential(
  repository: StudioRepository,
  secretKey: Buffer,
  userId: string,
  provider: "jimeng"
): Promise<JimengCredential> {
  const [row] = await repository.listProviderCredentials(userId).then((rows) => rows.filter((credential) => credential.provider === provider));
  if (!row) {
    throw new ProviderAdapterError({
      code: "CREDENTIAL_INVALID",
      message: "请先保存即梦 AK/SK。",
      retryable: false
    });
  }
  const payload = JSON.parse(
    decryptSecret(
      {
        encryptedSecret: row.encryptedSecret,
        iv: row.iv,
        authTag: row.authTag
      },
      secretKey
    )
  ) as SecretPayload;
  return payload;
}

async function pollProviderStatus({
  adapter,
  credential,
  maxStatusPolls,
  pollIntervalMs,
  providerTaskId,
  repository,
  taskId
}: {
  adapter: VideoProviderAdapter;
  credential: JimengCredential;
  maxStatusPolls: number;
  pollIntervalMs: number;
  providerTaskId: string;
  repository: StudioRepository;
  taskId: string;
}): Promise<ProviderTaskStatus> {
  for (let attempt = 1; attempt <= maxStatusPolls; attempt += 1) {
    const task = await repository.getGenerationTask(taskId);
    if (task.status === "canceled") return { status: "canceled" };
    const status = await adapter.getStatus(providerTaskId, credential);
    if (status.status !== "running") return status;
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  return {
    status: "failed",
    errorCode: "PROVIDER_TIMEOUT",
    errorMessage: "即梦生成仍未完成，请稍后重试。"
  };
}

async function failProviderStatus(taskId: string, status: ProviderTaskStatus, repository: StudioRepository): Promise<void> {
  const code = status.errorCode ?? "PROVIDER_FAILED";
  const message = status.errorMessage ?? "生成失败，请检查参数后重试。";
  await repository.markGenerationTaskFailed(taskId, code, message);
  if (isRetryableErrorCode(code)) {
    throw new ProviderAdapterError({
      code,
      message,
      retryable: true
    });
  }
}

async function markFailure(taskId: string, error: unknown, repository: StudioRepository): Promise<void> {
  if (error instanceof ProviderAdapterError) {
    await repository.markGenerationTaskFailed(taskId, error.code, error.message);
    return;
  }
  const message = error instanceof Error ? error.message : "生成失败";
  await repository.markGenerationTaskFailed(taskId, "INTERNAL_ERROR" as ErrorCode, message);
}
