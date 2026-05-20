import { Signer } from "@volcengine/openapi";
import type {
  EstimateInput,
  EstimateResult,
  JimengCredential,
  JimengGenerationParameters,
  ProviderAdapterError,
  ProviderInputAsset,
  ProviderErrorCode,
  ProviderTaskStatus,
  SubmitGenerationInput,
  SubmitGenerationResult,
  VideoProviderAdapter
} from "./types";
import { ProviderAdapterError as JimengProviderError } from "./types";

const DEFAULT_ENDPOINT = "https://visual.volcengineapi.com";
const DEFAULT_REGION = "cn-north-1";
const DEFAULT_REQ_KEY = "jimeng_t2v_v30";
const SERVICE = "cv";
const VERSION = "2022-08-31";

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

type JimengErrorLike = {
  status?: number | undefined;
  code?: string | undefined;
  message?: string | undefined;
  requestId?: string | undefined;
};

type JimengApiResponse<T> = {
  code?: number;
  data?: T;
  message?: string;
  request_id?: string;
  status?: number;
};

type SubmitTaskData = {
  task_id?: string;
};

type GetResultData = {
  status?: string;
  video_url?: string;
  image_urls?: string[];
  fail_reason?: string;
};

type CreateJimengAdapterOptions = {
  endpoint?: string;
  fetch?: FetchLike;
  region?: string;
  reqKey?: string;
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
  const message = error.message?.toLowerCase() ?? "";
  if (
    error.status === 401 ||
    error.status === 403 ||
    error.code === "AUTH_FAILED" ||
    message.includes("signature") ||
    message.includes("access key") ||
    message.includes("authorization")
  ) {
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

export function createJimengAdapter(options: CreateJimengAdapterOptions = {}): VideoProviderAdapter {
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
  const fetchImpl = options.fetch ?? fetch;
  const region = options.region ?? DEFAULT_REGION;

  return {
    provider: "jimeng",
    async estimate(input: EstimateInput): Promise<EstimateResult> {
      const assetCount = collectInputAssets(input).length;
      return {
        estimatedCostCents: assetCount > 0 ? Math.max(300, input.promptText.length * 2 + assetCount * 120) : 0,
        estimatedSeconds: 60
      };
    },
    async submit(input: SubmitGenerationInput): Promise<SubmitGenerationResult> {
      const credential = requireCredential(input);
      const reqKey = resolveReqKey(input.parameters, options.reqKey);
      const response = await callJimeng<SubmitTaskData>({
        action: "CVSync2AsyncSubmitTask",
        body: buildSubmitBody(input, reqKey),
        credential,
        endpoint,
        fetchImpl,
        region
      });
      const taskId = response.data?.task_id;
      if (!taskId) {
        throw mapJimengError({ message: response.message ?? "即梦没有返回任务编号。", requestId: response.request_id });
      }

      return { providerTaskId: encodeProviderTaskId({ reqKey, taskId }) };
    },
    async getStatus(providerTaskId: string, credentialInput: JimengCredential): Promise<ProviderTaskStatus> {
      const credential = requireCredential(credentialInput);
      const decoded = decodeProviderTaskId(providerTaskId);
      if (!decoded) {
        return { status: "failed", errorCode: "INVALID_TASK", errorMessage: "任务编号无效。" };
      }

      const response = await callJimeng<GetResultData>({
        action: "CVSync2AsyncGetResult",
        body: {
          req_key: decoded.reqKey,
          task_id: decoded.taskId
        },
        credential,
        endpoint,
        fetchImpl,
        region
      });
      const status = response.data?.status;
      if (status === "done") {
        const resultUrl = response.data?.video_url ?? response.data?.image_urls?.[0];
        return resultUrl
          ? { status: "succeeded", resultUrl, resultMimeType: resultMimeTypeForReqKey(decoded.reqKey), actualCostCents: 0 }
          : { status: "failed", errorCode: "PROVIDER_FAILED", errorMessage: "即梦没有返回结果地址。" };
      }
      if (status === "in_queue" || status === "generating" || status === "running") {
        return { status: "running" };
      }

      return {
        status: "failed",
        errorCode: "PROVIDER_FAILED",
        errorMessage: response.data?.fail_reason ?? response.message ?? "即梦生成失败。"
      };
    },
    async cancel(): Promise<void> {
      return;
    },
    async downloadResult(providerTaskId: string, resultUrl: string): Promise<Uint8Array> {
      if (!decodeProviderTaskId(providerTaskId) || resultUrl.trim().length === 0) {
        throw new JimengProviderError({
          code: "INVALID_TASK",
          message: "即梦结果地址无效，请重新生成。",
          retryable: false
        });
      }
      try {
        const response = await fetchImpl(resultUrl);
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

function requireCredential(input: JimengCredential): Required<JimengCredential> {
  const apiKey = input.apiKey?.trim();
  const secretKey = input.secretKey.trim();
  if (!apiKey || !secretKey) {
    throw new JimengProviderError({
      code: "CREDENTIAL_INVALID",
      message: "即梦 AK/SK 不能为空，请重新保存凭证。",
      retryable: false
    });
  }
  return { apiKey, secretKey };
}

async function callJimeng<T>({
  action,
  body,
  credential,
  endpoint,
  fetchImpl,
  region
}: {
  action: string;
  body: Record<string, unknown>;
  credential: Required<JimengCredential>;
  endpoint: string;
  fetchImpl: FetchLike;
  region: string;
}): Promise<JimengApiResponse<T>> {
  const requestBody = JSON.stringify(body);
  const requestData = {
    region,
    method: "POST",
    params: { Action: action, Version: VERSION },
    headers: { Region: region, Service: SERVICE, "Content-Type": "application/json" },
    body: requestBody
  };
  new Signer(requestData, SERVICE).addAuthorization({
    accessKeyId: credential.apiKey,
    secretKey: credential.secretKey
  });

  const url = new URL(endpoint);
  url.searchParams.set("Action", action);
  url.searchParams.set("Version", VERSION);

  const response = await fetchImpl(url, {
    method: "POST",
    headers: requestData.headers,
    body: requestBody
  });
  const text = await response.text();
  const parsed = parseJimengResponse<T>(text);
  if (!response.ok) {
    throw mapJimengError({ status: response.status, message: parsed.message ?? response.statusText, requestId: parsed.request_id });
  }
  if (parsed.code !== 10000) {
    throw mapJimengError({
      status: parsed.status ?? parsed.code,
      code: parsed.code ? String(parsed.code) : undefined,
      message: parsed.message,
      requestId: parsed.request_id
    });
  }
  return parsed;
}

function parseJimengResponse<T>(text: string): JimengApiResponse<T> {
  try {
    return JSON.parse(text) as JimengApiResponse<T>;
  } catch {
    return { message: text };
  }
}

function resolveReqKey(parameters: JimengGenerationParameters | null | undefined, explicitReqKey: string | undefined): string {
  const mode = parameters?.mode ?? "text_to_video";
  const configuredReqKey = explicitReqKey ?? process.env.JIMENG_REQ_KEY;
  const resolutionSuffix = parameters?.resolution === "1080p" || parameters?.modelId?.includes("1080") ? "_1080" : "";
  if (mode === "text_to_image" || parameters?.modelId === "jimeng-image-v3") return "jimeng_t2i_v30";
  if (mode === "first_last_frame" || parameters?.referenceMode === "first_last_frame") return `jimeng_i2v_first_tail_v30${resolutionSuffix}`;
  if (mode === "image_to_video") return `jimeng_i2v_first_v30${resolutionSuffix}`;
  if (mode === "reference_to_video") return `jimeng_i2v_recamera_v30${resolutionSuffix}`;
  const modelId = parameters?.modelId ?? "";
  if (modelId.toLowerCase().includes("pro")) return "jimeng_t2v_v30_pro";
  if (modelId.includes("1080")) return "jimeng_t2v_v30_1080p";
  if (configuredReqKey && mode === "text_to_video") return configuredReqKey;
  return DEFAULT_REQ_KEY;
}

function buildSubmitBody(input: SubmitGenerationInput, reqKey: string): Record<string, unknown> {
  if (isImageGeneration(input.parameters)) {
    const { width, height } = dimensionsForAspectRatio(input.parameters?.aspectRatio);
    return {
      req_key: reqKey,
      prompt: input.promptText,
      seed: -1,
      width,
      height,
      return_url: true,
      logo_info: {
        add_logo: false
      }
    };
  }

  return {
    req_key: reqKey,
    prompt: input.promptText,
    seed: -1,
    frames: toFrameCount(input.parameters?.durationSeconds),
    aspect_ratio: input.parameters?.aspectRatio ?? "16:9",
    ...buildImageInputBody(input)
  };
}

function isImageGeneration(parameters: JimengGenerationParameters | null | undefined): boolean {
  return parameters?.mode === "text_to_image" || parameters?.modelId === "jimeng-image-v3";
}

function dimensionsForAspectRatio(aspectRatio: string | undefined): { width: number; height: number } {
  switch (aspectRatio) {
    case "16:9":
      return { width: 1344, height: 768 };
    case "9:16":
      return { width: 768, height: 1344 };
    case "4:3":
      return { width: 1152, height: 864 };
    case "3:4":
      return { width: 864, height: 1152 };
    case "1:1":
    default:
      return { width: 1024, height: 1024 };
  }
}

function resultMimeTypeForReqKey(reqKey: string): string {
  return reqKey.includes("_t2i_") || reqKey.includes("_i2i_") ? "image/jpeg" : "video/mp4";
}

function collectInputAssets(input: EstimateInput): ProviderInputAsset[] {
  const structuredAssets = input.assets ?? [];
  if (structuredAssets.length > 0) return structuredAssets;
  return input.assetUrls.map((url) => ({ url }));
}

function buildImageInputBody(input: SubmitGenerationInput): Record<string, unknown> {
  const mode = input.parameters?.mode ?? "text_to_video";
  if (mode === "text_to_video" || mode === "text_to_image") return {};

  const assets = collectInputAssets(input).filter((asset) => asset.kind === undefined || asset.kind === "image");
  const requiredCount = mode === "first_last_frame" || input.parameters?.referenceMode === "first_last_frame" ? 2 : 1;
  if (assets.length !== requiredCount) {
    throw new JimengProviderError({
      code: "PROVIDER_FAILED",
      message: requiredCount === 2 ? "首尾帧生成需要引用 2 张图片。" : "图生视频需要引用 1 张图片。",
      retryable: false
    });
  }

  const imageUrls = assets.flatMap((asset) => (asset.url ? [asset.url] : []));
  if (imageUrls.length === assets.length) return { image_urls: imageUrls };

  const binaryDataBase64 = assets.map((asset) => {
    if (!asset.bytes) {
      throw new JimengProviderError({
        code: "PROVIDER_FAILED",
        message: "参考图缺少可提交的图片内容，请重新上传素材。",
        retryable: false
      });
    }
    return Buffer.from(asset.bytes).toString("base64");
  });
  return { binary_data_base64: binaryDataBase64 };
}

function toFrameCount(durationSeconds: number | undefined): number {
  const duration = durationSeconds && durationSeconds > 0 ? durationSeconds : 5;
  return duration * 24 + 1;
}

function encodeProviderTaskId(input: { reqKey: string; taskId: string }): string {
  return `jimeng:${Buffer.from(JSON.stringify(input)).toString("base64url")}`;
}

function decodeProviderTaskId(providerTaskId: string): { reqKey: string; taskId: string } | null {
  if (!providerTaskId.startsWith("jimeng:")) return null;
  try {
    const parsed = JSON.parse(Buffer.from(providerTaskId.slice("jimeng:".length), "base64url").toString("utf8")) as Partial<{
      reqKey: string;
      taskId: string;
    }>;
    return parsed.reqKey && parsed.taskId ? { reqKey: parsed.reqKey, taskId: parsed.taskId } : null;
  } catch {
    return null;
  }
}

export const jimengAdapter = createJimengAdapter();
