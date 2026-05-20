import {
  apiErrorSchema,
  assetSchema,
  createAssetUploadRequestSchema,
  completeAssetUploadRequestSchema,
  type ApiError,
  type Asset,
  type AssetKind,
  type CreateAssetUploadRequest,
  type CreateAssetUploadResponse,
  type CompleteAssetUploadRequest,
  type ErrorCode
} from "@video-stack/shared";
import type { AssetRecord, StudioRepository } from "../db/repositories";
import type { StorageService } from "./storage-service";

type AssetServiceOptions = {
  repository: StudioRepository;
  storage: StorageService;
  userId: string;
  now?: () => Date;
  idFactory?: () => string;
};

export type AssetContentRange = {
  start: number;
  end: number;
};

export type AssetContent = {
  bytes: Buffer;
  mimeType: string;
  sizeBytes: number;
  range?: AssetContentRange;
};

export type AssetService = {
  createUpload(input: CreateAssetUploadRequest): Promise<CreateAssetUploadResponse>;
  completeUpload(input: CompleteAssetUploadRequest): Promise<Asset>;
  listAssets(projectId: string): Promise<Asset[]>;
  acceptLocalUpload(storageKey: string, bytes: Buffer): Promise<void>;
  readAssetContent(assetId: string, rangeHeader?: string): Promise<AssetContent>;
};

export function createAssetService({ repository, storage, userId, now = () => new Date(), idFactory = () => crypto.randomUUID() }: AssetServiceOptions): AssetService {
  return {
    async createUpload(input) {
      const payload = createAssetUploadRequestSchema.parse(input);
      const assetId = idFactory();
      const kind = inferAssetKind(payload.mimeType);
      const safeName = payload.fileName.trim().slice(0, 160);
      const storageKey = `${payload.projectId}/assets/${assetId}/${safeName}`;

      const upload = await storage.createUpload(storageKey, payload.mimeType, payload.sizeBytes);
      await repository.createAsset({
        id: assetId,
        projectId: payload.projectId,
        userId,
        kind,
        mimeType: payload.mimeType,
        name: safeName,
        sizeBytes: payload.sizeBytes,
        durationMs: payload.durationMs ?? null,
        tosBucket: storage.bucket,
        tosKey: storageKey,
        status: "uploading"
      });

      return {
        assetId,
        uploadUrl: upload.url,
        uploadHeaders: upload.headers,
        storageKey,
        expiresAt: upload.expiresAt
      };
    },
    async completeUpload(input) {
      const payload = completeAssetUploadRequestSchema.parse(input);
      const row = await repository.getAsset(payload.assetId);
      if (row.projectId !== payload.projectId) {
        throw apiError("FORBIDDEN", "项目不匹配，请刷新后重试。");
      }
      if (row.tosKey !== payload.storageKey) {
        throw apiError("VALIDATION_ERROR", "素材标识已变更，请重新上传。");
      }

      const updated = await repository.markAssetReady(payload.assetId);
      return assetSchema.parse(toPublicAsset(updated, now));
    },
    async listAssets(projectId) {
      const rows = await repository.listAssets(projectId);
      return rows.map((row) => assetSchema.parse(toPublicAsset(row, now)));
    },
    async acceptLocalUpload(storageKey, bytes) {
      if (!storage.acceptLocalUpload) return;
      await storage.acceptLocalUpload(storageKey, bytes);
    },
    async readAssetContent(assetId, rangeHeader) {
      const row = await repository.getAsset(assetId);
      if (row.status !== "ready") {
        throw apiError("ASSET_NOT_READY", "素材仍在上传或已失效，请等待上传完成后再查看。");
      }
      if (!storage.readObject && !storage.readObjectRange) {
        throw apiError("VALIDATION_ERROR", "当前存储不支持读取素材内容。");
      }
      const range = parseRangeHeader(rangeHeader, row.sizeBytes);
      if (range && storage.readObjectRange) {
        return {
          bytes: await storage.readObjectRange(row.tosKey, range.start, range.end),
          mimeType: row.mimeType,
          sizeBytes: row.sizeBytes,
          range
        };
      }
      if (range && storage.readObject) {
        const bytes = await storage.readObject(row.tosKey);
        return {
          bytes: bytes.subarray(range.start, range.end + 1),
          mimeType: row.mimeType,
          sizeBytes: row.sizeBytes,
          range
        };
      }
      if (!storage.readObject) {
        throw apiError("VALIDATION_ERROR", "当前存储不支持完整读取素材内容。");
      }
      return {
        bytes: await storage.readObject(row.tosKey),
        mimeType: row.mimeType,
        sizeBytes: row.sizeBytes
      };
    }
  };
}

function inferAssetKind(mimeType: string): AssetKind {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  return "video";
}

function toPublicAsset(row: AssetRecord, now: () => Date): Asset {
  return {
    id: row.id,
    projectId: row.projectId,
    userId: row.userId,
    kind: row.kind,
    mimeType: row.mimeType as Asset["mimeType"],
    name: row.name,
    sizeBytes: row.sizeBytes,
    durationMs: row.durationMs ?? null,
    status: row.status,
    tosBucket: row.tosBucket ?? null,
    tosKey: row.tosKey,
    storageKey: row.tosKey,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null
  };
}

function parseRangeHeader(rangeHeader: string | undefined, sizeBytes: number): AssetContentRange | undefined {
  if (!rangeHeader) return undefined;
  if (!rangeHeader.startsWith("bytes=")) return undefined;
  const rangeSpec = rangeHeader.slice("bytes=".length).trim();
  if (rangeSpec.includes(",")) throw rangeError(sizeBytes);
  const match = /^(\d*)-(\d*)$/.exec(rangeSpec);
  if (!match) throw rangeError(sizeBytes);

  const [, startPart, endPart] = match;
  if (!startPart && !endPart) throw rangeError(sizeBytes);
  if (sizeBytes <= 0) throw rangeError(sizeBytes);

  if (!startPart) {
    const suffixLength = Number(endPart);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) throw rangeError(sizeBytes);
    return {
      start: Math.max(sizeBytes - suffixLength, 0),
      end: sizeBytes - 1
    };
  }

  const start = Number(startPart);
  const requestedEnd = endPart ? Number(endPart) : sizeBytes - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(requestedEnd) || start < 0 || requestedEnd < start || start >= sizeBytes) {
    throw rangeError(sizeBytes);
  }

  return {
    start,
    end: Math.min(requestedEnd, sizeBytes - 1)
  };
}

function rangeError(sizeBytes: number): ApiError {
  return apiError("VALIDATION_ERROR", "请求的视频范围无效。", {
    httpStatus: 416,
    contentRange: `bytes */${sizeBytes}`
  });
}

function apiError(code: ErrorCode, message: string, details?: Record<string, unknown>): ApiError {
  return apiErrorSchema.parse({
    error: {
      code,
      message,
      requestId: crypto.randomUUID().slice(0, 12),
      details
    }
  });
}
