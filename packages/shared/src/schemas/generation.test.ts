import { describe, expect, it } from "vitest";
import { estimateGenerationRequestSchema, requiresSecondConfirm } from "./generation";

describe("estimateGenerationRequestSchema", () => {
  it("accepts a valid generation estimate request", () => {
    const result = estimateGenerationRequestSchema.safeParse({
      projectId: "00000000-0000-4000-8000-000000000001",
      promptText: "生成 8 秒产品展示视频",
      assetRefs: [],
      provider: "jimeng"
    });

    expect(result.success).toBe(true);
  });

  it("marks high cost estimates for second confirmation", () => {
    expect(requiresSecondConfirm(2_000)).toBe(true);
    expect(requiresSecondConfirm(1_999)).toBe(false);
  });
});
