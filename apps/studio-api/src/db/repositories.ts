import type { InferSelectModel } from "drizzle-orm";
import type { AssetMention, ErrorCode, Provider } from "@video-stack/shared";
import { assets, generationTasks, projects, providerCredentials, users } from "./schema";

export type UserRecord = InferSelectModel<typeof users>;
export type ProjectRecord = InferSelectModel<typeof projects>;
export type AssetRecord = InferSelectModel<typeof assets>;
export type ProviderCredentialRecord = InferSelectModel<typeof providerCredentials>;
export type GenerationTaskRecord = InferSelectModel<typeof generationTasks>;

type CreateUserInput = {
  email: string;
  id?: string;
  status?: UserRecord["status"];
};

type CreateProjectInput = {
  userId: string;
  name: string;
  id?: string;
  status?: ProjectRecord["status"];
};

type CreateAssetInput = {
  projectId: string;
  userId: string;
  kind: AssetRecord["kind"];
  mimeType: string;
  name: string;
  sizeBytes: number;
  tosKey: string;
  durationMs?: number | null;
  tosBucket?: string | null;
  id?: string;
  status?: AssetRecord["status"];
};

type CreateProviderCredentialInput = {
  userId: string;
  provider: Provider;
  displayName: string;
  encryptedSecret: string;
  iv: string;
  authTag: string;
  maskedLabel: string;
  id?: string;
  status?: ProviderCredentialRecord["status"];
};

type CreateGenerationTaskInput = {
  projectId: string;
  userId: string;
  provider: Provider;
  promptDoc: Record<string, unknown>;
  promptText: string;
  assetRefs: AssetMention[];
  estimatedCostCents: number;
  id?: string;
  actualCostCents?: number | null;
  requiresSecondConfirm?: boolean;
  status?: GenerationTaskRecord["status"];
};

export type StudioRepository = {
  createUser(input: CreateUserInput): Promise<UserRecord>;
  createProject(input: CreateProjectInput): Promise<ProjectRecord>;
  createAsset(input: CreateAssetInput): Promise<AssetRecord>;
  getAsset(assetId: string): Promise<AssetRecord>;
  listAssets(projectId: string): Promise<AssetRecord[]>;
  markAssetReady(assetId: string): Promise<AssetRecord>;
  markAssetRejected(assetId: string): Promise<AssetRecord>;
  createProviderCredential(input: CreateProviderCredentialInput): Promise<ProviderCredentialRecord>;
  listProviderCredentials(userId: string): Promise<ProviderCredentialRecord[]>;
  getProviderCredential(credentialId: string): Promise<ProviderCredentialRecord>;
  revokeProviderCredential(credentialId: string): Promise<ProviderCredentialRecord>;
  createGenerationTask(input: CreateGenerationTaskInput): Promise<GenerationTaskRecord>;
  softDeleteAsset(assetId: string): Promise<AssetRecord>;
  markGenerationTaskFailed(taskId: string, errorCode: ErrorCode, errorMessage: string): Promise<GenerationTaskRecord>;
  markGenerationTaskSucceeded(taskId: string, resultAssetId: string, actualCostCents: number): Promise<GenerationTaskRecord>;
};

type RepositoryOptions = {
  idFactory?: () => string;
  now?: () => Date;
};

function notFound(entity: string, id: string): Error {
  return new Error(`${entity} 不存在：${id}`);
}

export function createInMemoryStudioRepository(options: RepositoryOptions = {}): StudioRepository {
  const idFactory = options.idFactory ?? crypto.randomUUID;
  const now = options.now ?? (() => new Date());
  const userRows = new Map<string, UserRecord>();
  const projectRows = new Map<string, ProjectRecord>();
  const assetRows = new Map<string, AssetRecord>();
  const credentialRows = new Map<string, ProviderCredentialRecord>();
  const taskRows = new Map<string, GenerationTaskRecord>();

  return {
    async createUser(input) {
      const createdAt = now();
      const row: UserRecord = {
        id: input.id ?? idFactory(),
        email: input.email,
        status: input.status ?? "active",
        createdAt,
        updatedAt: createdAt,
        deletedAt: null
      };
      userRows.set(row.id, row);
      return row;
    },
    async createProject(input) {
      if (!userRows.has(input.userId)) throw notFound("用户", input.userId);
      const createdAt = now();
      const row: ProjectRecord = {
        id: input.id ?? idFactory(),
        userId: input.userId,
        name: input.name,
        status: input.status ?? "active",
        createdAt,
        updatedAt: createdAt,
        deletedAt: null
      };
      projectRows.set(row.id, row);
      return row;
    },
    async createAsset(input) {
      if (!projectRows.has(input.projectId)) throw notFound("项目", input.projectId);
      if (!userRows.has(input.userId)) throw notFound("用户", input.userId);
      const createdAt = now();
      const row: AssetRecord = {
        id: input.id ?? idFactory(),
        projectId: input.projectId,
        userId: input.userId,
        kind: input.kind,
        mimeType: input.mimeType,
        name: input.name,
        sizeBytes: input.sizeBytes,
        durationMs: input.durationMs ?? null,
        tosBucket: input.tosBucket ?? null,
        tosKey: input.tosKey,
        status: input.status ?? "uploading",
        createdAt,
        updatedAt: createdAt,
        deletedAt: null
      };
      assetRows.set(row.id, row);
      return row;
    },
    async getAsset(assetId) {
      const row = assetRows.get(assetId);
      if (!row || row.deletedAt !== null || row.status === "deleted") throw notFound("素材", assetId);
      return row;
    },
    async listAssets(projectId) {
      if (!projectRows.has(projectId)) throw notFound("项目", projectId);
      return [...assetRows.values()]
        .filter((row) => row.projectId === projectId && row.deletedAt === null && row.status !== "deleted")
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
    },
    async markAssetReady(assetId) {
      const row = assetRows.get(assetId);
      if (!row || row.deletedAt !== null || row.status === "deleted") throw notFound("素材", assetId);
      const updatedAt = now();
      const updated: AssetRecord = {
        ...row,
        status: "ready",
        updatedAt
      };
      assetRows.set(assetId, updated);
      return updated;
    },
    async markAssetRejected(assetId) {
      const row = assetRows.get(assetId);
      if (!row || row.deletedAt !== null || row.status === "deleted") throw notFound("素材", assetId);
      const updatedAt = now();
      const updated: AssetRecord = {
        ...row,
        status: "rejected",
        updatedAt
      };
      assetRows.set(assetId, updated);
      return updated;
    },
    async createProviderCredential(input) {
      if (!userRows.has(input.userId)) throw notFound("用户", input.userId);
      const createdAt = now();
      const row: ProviderCredentialRecord = {
        id: input.id ?? idFactory(),
        userId: input.userId,
        provider: input.provider,
        displayName: input.displayName,
        encryptedSecret: input.encryptedSecret,
        iv: input.iv,
        authTag: input.authTag,
        maskedLabel: input.maskedLabel,
        status: input.status ?? "active",
        createdAt,
        updatedAt: createdAt,
        deletedAt: null
      };
      credentialRows.set(row.id, row);
      return row;
    },
    async listProviderCredentials(userId) {
      if (!userRows.has(userId)) throw notFound("用户", userId);
      return [...credentialRows.values()]
        .filter((row) => row.userId === userId && row.status === "active" && row.deletedAt === null)
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
    },
    async getProviderCredential(credentialId) {
      const row = credentialRows.get(credentialId);
      if (!row || row.status !== "active" || row.deletedAt !== null) throw notFound("凭证", credentialId);
      return row;
    },
    async revokeProviderCredential(credentialId) {
      const row = credentialRows.get(credentialId);
      if (!row || row.status !== "active" || row.deletedAt !== null) throw notFound("凭证", credentialId);
      const revokedAt = now();
      const updated: ProviderCredentialRecord = {
        ...row,
        status: "deleted",
        updatedAt: revokedAt,
        deletedAt: revokedAt
      };
      credentialRows.set(credentialId, updated);
      return updated;
    },
    async createGenerationTask(input) {
      if (!projectRows.has(input.projectId)) throw notFound("项目", input.projectId);
      if (!userRows.has(input.userId)) throw notFound("用户", input.userId);
      const createdAt = now();
      const row: GenerationTaskRecord = {
        id: input.id ?? idFactory(),
        projectId: input.projectId,
        userId: input.userId,
        provider: input.provider,
        promptDoc: input.promptDoc,
        promptText: input.promptText,
        assetRefs: input.assetRefs,
        status: input.status ?? "draft",
        estimatedCostCents: input.estimatedCostCents,
        actualCostCents: input.actualCostCents ?? null,
        requiresSecondConfirm: input.requiresSecondConfirm ?? false,
        providerTaskId: null,
        resultAssetId: null,
        errorCode: null,
        errorMessage: null,
        createdAt,
        updatedAt: createdAt,
        startedAt: null,
        finishedAt: null,
        deletedAt: null
      };
      taskRows.set(row.id, row);
      return row;
    },
    async softDeleteAsset(assetId) {
      const row = assetRows.get(assetId);
      if (!row) throw notFound("素材", assetId);
      const deletedAt = now();
      const updated: AssetRecord = {
        ...row,
        status: "deleted",
        updatedAt: deletedAt,
        deletedAt
      };
      assetRows.set(assetId, updated);
      return updated;
    },
    async markGenerationTaskFailed(taskId, errorCode, errorMessage) {
      const row = taskRows.get(taskId);
      if (!row) throw notFound("任务", taskId);
      const updatedAt = now();
      const updated: GenerationTaskRecord = {
        ...row,
        status: "failed",
        errorCode,
        errorMessage,
        updatedAt,
        finishedAt: updatedAt
      };
      taskRows.set(taskId, updated);
      return updated;
    },
    async markGenerationTaskSucceeded(taskId, resultAssetId, actualCostCents) {
      const row = taskRows.get(taskId);
      if (!row) throw notFound("任务", taskId);
      if (!assetRows.has(resultAssetId)) throw notFound("结果素材", resultAssetId);
      const updatedAt = now();
      const updated: GenerationTaskRecord = {
        ...row,
        status: "succeeded",
        actualCostCents,
        resultAssetId,
        errorCode: null,
        errorMessage: null,
        updatedAt,
        finishedAt: updatedAt
      };
      taskRows.set(taskId, updated);
      return updated;
    }
  };
}
