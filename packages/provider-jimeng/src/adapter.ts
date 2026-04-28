import type {
  EstimateInput,
  EstimateResult,
  ProviderTaskStatus,
  SubmitGenerationInput,
  SubmitGenerationResult,
  VideoProviderAdapter
} from "./types";

export function createJimengAdapter(): VideoProviderAdapter {
  return {
    provider: "jimeng",
    async estimate(input: EstimateInput): Promise<EstimateResult> {
      return {
        estimatedCostCents: Math.max(300, input.promptText.length * 2 + input.assetUrls.length * 120),
        estimatedSeconds: 45
      };
    },
    async submit(input: SubmitGenerationInput): Promise<SubmitGenerationResult> {
      if (input.secretKey.trim().length === 0) {
        throw new Error("即梦凭证不能为空");
      }
      return { providerTaskId: `jimeng_${crypto.randomUUID()}` };
    },
    async getStatus(providerTaskId: string): Promise<ProviderTaskStatus> {
      if (!providerTaskId.startsWith("jimeng_")) {
        return { status: "failed", errorCode: "INVALID_TASK", errorMessage: "任务编号无效" };
      }
      return { status: "succeeded", resultUrl: `https://assets.example.com/${providerTaskId}.mp4` };
    },
    async cancel(): Promise<void> {
      return;
    }
  };
}

export const jimengAdapter = createJimengAdapter();
