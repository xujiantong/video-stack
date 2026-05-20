import { describe, expect, it } from "vitest";
import { createJimengAdapter, mapJimengError } from "./adapter";
import { ProviderAdapterError } from "./types";

describe("jimeng adapter", () => {
  it("estimates generation cost from prompt and asset count", async () => {
    const adapter = createJimengAdapter();

    await expect(adapter.estimate({ promptText: "生成产品视频", assetUrls: ["https://example.com/a.png"] })).resolves.toEqual({
      estimatedCostCents: 300,
      estimatedSeconds: 60
    });
  });

  it("rejects empty credentials without retry", async () => {
    const adapter = createJimengAdapter();

    await expect(adapter.submit({ apiKey: "ak", promptText: "生成视频", assetUrls: [], secretKey: " " })).rejects.toMatchObject({
      code: "CREDENTIAL_INVALID",
      retryable: false
    });
  });

  it("submits and polls a real Jimeng task through signed API calls", async () => {
    const requests: string[] = [];
    const adapter = createJimengAdapter({
      fetch: async (_url, init) => {
        requests.push(String(init?.body));
        if (requests.length === 1) {
          return new Response(JSON.stringify({ code: 10000, data: { task_id: "task-1" }, message: "Success" }));
        }
        return new Response(JSON.stringify({ code: 10000, data: { status: "done", video_url: "https://example.com/result.mp4" } }));
      }
    });

    const submitted = await adapter.submit({
      apiKey: "ak_demo",
      secretKey: "sk_demo",
      promptText: "生成视频",
      assetUrls: [],
      parameters: { aspectRatio: "16:9", durationSeconds: 5, mode: "text_to_video" }
    });
    const status = await adapter.getStatus(submitted.providerTaskId, { apiKey: "ak_demo", secretKey: "sk_demo" });

    expect(status).toMatchObject({ status: "succeeded", resultUrl: "https://example.com/result.mp4" });
    expect(requests[0]).toContain("jimeng_t2v_v30");
  });

  it("maps selected 1080P and Pro models to their Jimeng req_key", async () => {
    const requests: string[] = [];
    const adapter = createJimengAdapter({
      fetch: async (_url, init) => {
        requests.push(String(init?.body));
        return new Response(JSON.stringify({ code: 10000, data: { task_id: "task-1" }, message: "Success" }));
      },
      reqKey: "jimeng_t2v_v30"
    });

    await adapter.submit({
      apiKey: "ak_demo",
      secretKey: "sk_demo",
      promptText: "生成视频",
      assetUrls: [],
      parameters: { aspectRatio: "16:9", durationSeconds: 5, mode: "text_to_video", modelId: "jimeng-video-v3-1080p", resolution: "1080p" }
    });
    await adapter.submit({
      apiKey: "ak_demo",
      secretKey: "sk_demo",
      promptText: "生成视频",
      assetUrls: [],
      parameters: { aspectRatio: "16:9", durationSeconds: 5, mode: "text_to_video", modelId: "jimeng-video-v3-pro-1080p", resolution: "1080p" }
    });

    expect(requests[0]).toContain("jimeng_t2v_v30_1080p");
    expect(requests[1]).toContain("jimeng_t2v_v30_pro");
  });

  it("submits Jimeng image 3.0 generation and reads image result URLs", async () => {
    const requests: string[] = [];
    const adapter = createJimengAdapter({
      fetch: async (_url, init) => {
        requests.push(String(init?.body));
        if (requests.length === 1) {
          return new Response(JSON.stringify({ code: 10000, data: { task_id: "image-task-1" }, message: "Success" }));
        }
        return new Response(JSON.stringify({ code: 10000, data: { status: "done", image_urls: ["https://example.com/result.jpg"] } }));
      }
    });

    const submitted = await adapter.submit({
      apiKey: "ak_demo",
      secretKey: "sk_demo",
      promptText: "一张有中文标题的产品海报",
      assetUrls: [],
      parameters: { aspectRatio: "1:1", durationSeconds: 5, mode: "text_to_image", modelId: "jimeng-image-v3", resolution: "1080p" }
    });
    const status = await adapter.getStatus(submitted.providerTaskId, { apiKey: "ak_demo", secretKey: "sk_demo" });

    expect(status).toMatchObject({ status: "succeeded", resultUrl: "https://example.com/result.jpg", resultMimeType: "image/jpeg" });
    expect(requests[0]).toContain("jimeng_t2i_v30");
    expect(requests[0]).toContain('"return_url":true');
    expect(requests[0]).not.toContain('"frames"');
  });

  it("submits image-to-video assets as base64 image data", async () => {
    const requests: string[] = [];
    const adapter = createJimengAdapter({
      fetch: async (_url, init) => {
        requests.push(String(init?.body));
        return new Response(JSON.stringify({ code: 10000, data: { task_id: "task-1" }, message: "Success" }));
      }
    });

    await adapter.submit({
      apiKey: "ak_demo",
      secretKey: "sk_demo",
      promptText: "让产品缓慢旋转",
      assetUrls: [],
      assets: [{ bytes: new Uint8Array([1, 2, 3]), kind: "image", mimeType: "image/png" }],
      parameters: { aspectRatio: "16:9", durationSeconds: 5, mode: "image_to_video", referenceMode: "image" }
    });

    expect(requests[0]).toContain("jimeng_i2v_first_v30");
    expect(requests[0]).toContain("binary_data_base64");
    expect(requests[0]).toContain("AQID");
  });

  it("submits first-last-frame generation with two image URLs", async () => {
    const requests: string[] = [];
    const adapter = createJimengAdapter({
      fetch: async (_url, init) => {
        requests.push(String(init?.body));
        return new Response(JSON.stringify({ code: 10000, data: { task_id: "task-1" }, message: "Success" }));
      }
    });

    await adapter.submit({
      apiKey: "ak_demo",
      secretKey: "sk_demo",
      promptText: "从白天过渡到夜晚",
      assetUrls: ["https://example.com/first.png", "https://example.com/last.png"],
      parameters: { aspectRatio: "16:9", durationSeconds: 5, mode: "first_last_frame", referenceMode: "first_last_frame" }
    });

    expect(requests[0]).toContain("jimeng_i2v_first_tail_v30");
    expect(requests[0]).toContain("image_urls");
    expect(requests[0]).toContain("https://example.com/first.png");
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

    const submitted = await createJimengAdapter({
      fetch: async () => new Response(JSON.stringify({ code: 10000, data: { task_id: "task-1" } }))
    }).submit({ apiKey: "ak_demo", secretKey: "sk_demo", promptText: "生成视频", assetUrls: [] });
    await expect(adapter.downloadResult(submitted.providerTaskId, "data:video/mp4;base64,AQID")).resolves.toBeInstanceOf(Uint8Array);
  });
});
