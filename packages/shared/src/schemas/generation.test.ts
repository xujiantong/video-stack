import { describe, expect, it } from "vitest";
import {
  createGenerationRequestSchema,
  estimateGenerationRequestSchema,
  generationJobPayloadSchema,
  generationTaskSchema,
  requiresSecondConfirm
} from "./generation";

describe("estimateGenerationRequestSchema", () => {
  it("accepts a valid generation estimate request", () => {
    const result = estimateGenerationRequestSchema.safeParse({
      projectId: "00000000-0000-4000-8000-000000000001",
      promptText: "生成 8 秒产品展示视频",
      assetRefs: [],
      provider: "jimeng",
      parameters: {
        modelId: "seedance-demo",
        mode: "text_to_video",
        referenceMode: "none",
        aspectRatio: "16:9",
        resolution: "1080p",
        durationSeconds: 10
      }
    });

    expect(result.success).toBe(true);
  });

  it("marks high cost estimates for second confirmation", () => {
    expect(requiresSecondConfirm(2_000)).toBe(true);
    expect(requiresSecondConfirm(1_999)).toBe(false);
  });

  it("validates create requests, task records, and queue payloads", () => {
    const now = "2026-04-28T07:24:30.146Z";
    const base = {
      projectId: "00000000-0000-4000-8000-000000000001",
      promptText: "生成 8 秒产品展示视频",
      assetRefs: [],
      provider: "jimeng" as const,
      credentialId: "00000000-0000-4000-8000-000000000401"
    };

    expect(createGenerationRequestSchema.safeParse(base).success).toBe(true);
    expect(
      generationTaskSchema.safeParse({
        id: "00000000-0000-4000-8000-000000000201",
        projectId: base.projectId,
        provider: "jimeng",
        promptText: base.promptText,
        assetRefs: [],
        status: "queued",
        estimatedCostCents: 860,
        actualCostCents: null,
        requiresSecondConfirm: false,
        resultAssetId: null,
        errorCode: null,
        errorMessage: null,
        createdAt: now,
        updatedAt: now
      }).success
    ).toBe(true);
    expect(
      generationJobPayloadSchema.safeParse({
        taskId: "00000000-0000-4000-8000-000000000201",
        userId: "00000000-0000-4000-8000-000000000501",
        projectId: base.projectId,
        provider: "jimeng",
        attempt: 1
      }).success
    ).toBe(true);
  });
});
