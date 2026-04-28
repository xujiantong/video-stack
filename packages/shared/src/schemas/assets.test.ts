import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES } from "../constants";
import { assetMentionSchema, assetSchema, createAssetUploadRequestSchema, createAssetUploadResponseSchema } from "./assets";

const projectId = "00000000-0000-4000-8000-000000000001";
const assetId = "00000000-0000-4000-8000-000000000101";
const now = "2026-04-28T07:24:30.146Z";

describe("asset schemas", () => {
  it("accepts supported image, video, and audio upload metadata", () => {
    const result = createAssetUploadRequestSchema.safeParse({
      projectId,
      fileName: "旁白.wav",
      mimeType: "audio/wav",
      sizeBytes: 1024,
      durationMs: 12_000
    });

    expect(result.success).toBe(true);
  });

  it("rejects files larger than the upload limit", () => {
    const result = createAssetUploadRequestSchema.safeParse({
      projectId,
      fileName: "large.mp4",
      mimeType: "video/mp4",
      sizeBytes: MAX_UPLOAD_BYTES + 1,
      durationMs: 10_000
    });

    expect(result.success).toBe(false);
  });

  it("accepts local upload paths and remote presigned URLs", () => {
    const baseResponse = {
      assetId,
      uploadHeaders: {},
      storageKey: `${projectId}/assets/${assetId}/demo.png`,
      expiresAt: now
    };

    expect(
      createAssetUploadResponseSchema.safeParse({
        ...baseResponse,
        uploadUrl: `/api/assets/uploads/${encodeURIComponent(baseResponse.storageKey)}`
      }).success
    ).toBe(true);
    expect(
      createAssetUploadResponseSchema.safeParse({
        ...baseResponse,
        uploadUrl: "https://objects.example.com/studio-assets/demo.png"
      }).success
    ).toBe(true);
  });

  it("validates persisted asset records and asset references", () => {
    const assetResult = assetSchema.safeParse({
      id: assetId,
      projectId,
      kind: "image",
      mimeType: "image/png",
      name: "包装主图",
      sizeBytes: 2048,
      durationMs: null,
      status: "ready",
      storageKey: "projects/demo/assets/main.png",
      createdAt: now
    });

    const mentionResult = assetMentionSchema.safeParse({
      id: assetId,
      kind: "image",
      label: "包装主图"
    });

    expect(assetResult.success).toBe(true);
    expect(mentionResult.success).toBe(true);
  });
});
