import { describe, expect, it } from "vitest";
import { apiErrorSchema, isRetryableErrorCode, providerErrorSchema } from "./errors";

describe("error schemas", () => {
  it("validates the fixed API error response shape", () => {
    const result = apiErrorSchema.safeParse({
      error: {
        code: "UPLOAD_FILE_TOO_LARGE",
        message: "文件超过 200 MB，请压缩后再上传。",
        requestId: "req_01h_demo"
      }
    });

    expect(result.success).toBe(true);
  });

  it("marks provider timeout and rate limit errors as retryable", () => {
    expect(isRetryableErrorCode("PROVIDER_TIMEOUT")).toBe(true);
    expect(isRetryableErrorCode("PROVIDER_RATE_LIMITED")).toBe(true);
    expect(isRetryableErrorCode("CREDENTIAL_INVALID")).toBe(false);
  });

  it("validates provider error mapping", () => {
    const result = providerErrorSchema.safeParse({
      code: "INVALID_TASK",
      message: "任务编号无效",
      retryable: false
    });

    expect(result.success).toBe(true);
  });
});
