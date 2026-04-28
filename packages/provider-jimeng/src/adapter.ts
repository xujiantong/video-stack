import type {
  EstimateInput,
  EstimateResult,
  ProviderAdapterError,
  ProviderErrorCode,
  ProviderTaskStatus,
  SubmitGenerationInput,
  SubmitGenerationResult,
  VideoProviderAdapter
} from "./types";
import { ProviderAdapterError as JimengProviderError } from "./types";

type JimengErrorLike = {
  status?: number;
  code?: string;
  message?: string;
  requestId?: string;
};

function providerError(input: {
  code: ProviderErrorCode;
  message: string;
  retryable: boolean;
  providerRequestId?: string | undefined;
}) {
  return new JimengProviderError(
    input.providerRequestId
      ? input
      : {
          code: input.code,
          message: input.message,
          retryable: input.retryable
        }
  );
}

export function mapJimengError(error: JimengErrorLike): ProviderAdapterError {
  if (error.status === 401 || error.status === 403 || error.code === "AUTH_FAILED") {
    return providerError({
      code: "CREDENTIAL_INVALID",
      message: "即梦凭证无效，请更新 API Key 后重试。",
      retryable: false,
      providerRequestId: error.requestId
    });
  }
  if (error.status === 429 || error.code === "RATE_LIMIT") {
    return providerError({
      code: "PROVIDER_RATE_LIMITED",
      message: "即梦限流，请稍后自动重试。",
      retryable: true,
      providerRequestId: error.requestId
    });
  }
  if (error.code === "TIMEOUT") {
    return providerError({
      code: "PROVIDER_TIMEOUT",
      message: "即梦响应超时，请稍后自动重试。",
      retryable: true,
      providerRequestId: error.requestId
    });
  }
  if (typeof error.status === "number" && error.status >= 500) {
    return providerError({
      code: "PROVIDER_FAILED",
      message: "即梦服务暂时不可用，请稍后自动重试。",
      retryable: true,
      providerRequestId: error.requestId
    });
  }
  return providerError({
    code: "PROVIDER_FAILED",
    message: error.message ?? "即梦生成失败，请检查参数后重试。",
    retryable: false,
    providerRequestId: error.requestId
  });
}

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
        throw new JimengProviderError({
          code: "CREDENTIAL_INVALID",
          message: "即梦凭证不能为空，请重新保存凭证。",
          retryable: false
        });
      }
      return { providerTaskId: `jimeng_${crypto.randomUUID()}` };
    },
    async getStatus(providerTaskId: string): Promise<ProviderTaskStatus> {
      if (!providerTaskId.startsWith("jimeng_")) {
        return { status: "failed", errorCode: "INVALID_TASK", errorMessage: "任务编号无效" };
      }
      return {
        status: "succeeded",
        resultUrl: `data:video/mp4;base64,${Buffer.from(`jimeng-result:${providerTaskId}`).toString("base64")}`,
        actualCostCents: 300
      };
    },
    async cancel(): Promise<void> {
      return;
    },
    async downloadResult(providerTaskId: string, resultUrl: string): Promise<Uint8Array> {
      if (!providerTaskId.startsWith("jimeng_") || resultUrl.trim().length === 0) {
        throw new JimengProviderError({
          code: "INVALID_TASK",
          message: "即梦结果地址无效，请重新生成。",
          retryable: false
        });
      }
      try {
        const response = await fetch(resultUrl);
        if (!response.ok) {
          throw mapJimengError({ status: response.status, message: response.statusText });
        }
        return new Uint8Array(await response.arrayBuffer());
      } catch (error) {
        if (error instanceof JimengProviderError) throw error;
        throw mapJimengError({ code: "TIMEOUT" });
      }
    }
  };
}

export const jimengAdapter = createJimengAdapter();
