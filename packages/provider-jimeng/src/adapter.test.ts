import { describe, expect, it } from "vitest";
import { createJimengAdapter, mapJimengError } from "./adapter";
import { ProviderAdapterError } from "./types";

describe("jimeng adapter", () => {
  it("estimates generation cost from prompt and asset count", async () => {
    const adapter = createJimengAdapter();

    await expect(adapter.estimate({ promptText: "生成产品视频", assetUrls: ["https://example.com/a.png"] })).resolves.toEqual({
      estimatedCostCents: 300,
      estimatedSeconds: 45
    });
  });

  it("rejects empty credentials without retry", async () => {
    const adapter = createJimengAdapter();

    await expect(adapter.submit({ promptText: "生成视频", assetUrls: [], secretKey: " " })).rejects.toMatchObject({
      code: "CREDENTIAL_INVALID",
      retryable: false
    });
  });

  it("maps rate limit errors to retryable internal errors", () => {
    const error = mapJimengError({ status: 429, requestId: "req_1" });

    expect(error).toBeInstanceOf(ProviderAdapterError);
    expect(error).toMatchObject({
      code: "PROVIDER_RATE_LIMITED",
      retryable: true,
      providerRequestId: "req_1"
    });
  });

  it("downloads generated results through the adapter boundary", async () => {
    const adapter = createJimengAdapter();

    await expect(adapter.downloadResult("jimeng_task", "data:video/mp4;base64,AQID")).resolves.toBeInstanceOf(Uint8Array);
  });
});
