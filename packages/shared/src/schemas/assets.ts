import { z } from "zod";
import { ASSET_KINDS, ASSET_STATUSES, MAX_AUDIO_DURATION_MS, MAX_UPLOAD_BYTES, MAX_VIDEO_DURATION_MS, SUPPORTED_UPLOAD_MIME_TYPES } from "../constants";

export const supportedUploadMimeTypeSchema = z.enum(SUPPORTED_UPLOAD_MIME_TYPES);

export const assetKindSchema = z.enum(ASSET_KINDS);

export const assetStatusSchema = z.enum(ASSET_STATUSES);

export const assetMentionSchema = z.object({
  id: z.string().uuid(),
  kind: assetKindSchema,
  label: z.string().min(1).max(80)
});

export const assetUploadMetadataSchema = z.object({
  fileName: z.string().min(1).max(160),
  mimeType: supportedUploadMimeTypeSchema,
  sizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  durationMs: z.number().int().positive().max(MAX_AUDIO_DURATION_MS).nullable().optional()
});

export const assetSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  userId: z.string().uuid().optional(),
  kind: assetKindSchema,
  mimeType: supportedUploadMimeTypeSchema,
  name: z.string().min(1).max(160),
  sizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  durationMs: z.number().int().positive().max(MAX_AUDIO_DURATION_MS).nullable(),
  status: assetStatusSchema,
  tosBucket: z.string().min(1).nullable().optional(),
  tosKey: z.string().min(1).nullable().optional(),
  storageKey: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
  deletedAt: z.string().datetime().nullable().optional()
});

export const createAssetUploadRequestSchema = z.object({
  projectId: z.string().uuid(),
  fileName: assetUploadMetadataSchema.shape.fileName,
  mimeType: assetUploadMetadataSchema.shape.mimeType,
  sizeBytes: assetUploadMetadataSchema.shape.sizeBytes,
  durationMs: assetUploadMetadataSchema.shape.durationMs
}).superRefine((input, context) => {
  if (input.mimeType.startsWith("video/") && input.durationMs && input.durationMs > MAX_VIDEO_DURATION_MS) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "视频时长不能超过 60 秒。",
      path: ["durationMs"]
    });
  }
});

export const createAssetUploadResponseSchema = z.object({
  assetId: z.string().uuid(),
  uploadUrl: z.union([z.string().url(), z.string().regex(/^\/\S*$/, "上传地址必须是 URL 或站内路径。")]),
  uploadHeaders: z.record(z.string()),
  storageKey: z.string().min(1),
  expiresAt: z.string().datetime()
});

export const completeAssetUploadRequestSchema = z.object({
  assetId: z.string().uuid(),
  projectId: z.string().uuid(),
  storageKey: z.string().min(1),
  checksum: z.string().min(8).max(256).optional()
});

export type AssetKind = z.infer<typeof assetKindSchema>;
export type AssetStatus = z.infer<typeof assetStatusSchema>;
export type AssetMention = z.infer<typeof assetMentionSchema>;
export type AssetUploadMetadata = z.infer<typeof assetUploadMetadataSchema>;
export type Asset = z.infer<typeof assetSchema>;
export type CreateAssetUploadRequest = z.infer<typeof createAssetUploadRequestSchema>;
export type CreateAssetUploadResponse = z.infer<typeof createAssetUploadResponseSchema>;
export type CompleteAssetUploadRequest = z.infer<typeof completeAssetUploadRequestSchema>;
