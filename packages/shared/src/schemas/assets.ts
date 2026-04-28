import { z } from "zod";
import { MAX_UPLOAD_BYTES, SUPPORTED_UPLOAD_MIME_TYPES } from "../constants";

export const supportedUploadMimeTypeSchema = z.enum(SUPPORTED_UPLOAD_MIME_TYPES);

export const assetKindSchema = z.enum(["image", "video", "audio"]);

export const assetSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  kind: assetKindSchema,
  mimeType: supportedUploadMimeTypeSchema,
  name: z.string().min(1).max(160),
  sizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  storageKey: z.string().min(1),
  createdAt: z.string().datetime()
});

export const createAssetUploadRequestSchema = z.object({
  projectId: z.string().uuid(),
  fileName: z.string().min(1).max(160),
  mimeType: supportedUploadMimeTypeSchema,
  sizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES)
});

export type Asset = z.infer<typeof assetSchema>;
export type CreateAssetUploadRequest = z.infer<typeof createAssetUploadRequestSchema>;
