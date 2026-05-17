import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { createInMemoryStudioRepository } from "../db/repositories";
import { createInMemoryGenerationQueue } from "../queue/generation-queue";
import { createGenerationRoutes } from "./generation";

const userId = "00000000-0000-4000-8000-000000000501";
const projectId = "00000000-0000-4000-8000-000000000001";
const credentialId = "00000000-0000-4000-8000-000000000401";
const readyAssetId = "00000000-0000-4000-8000-000000000101";
const uploadingAssetId = "00000000-0000-4000-8000-000000000102";

const baseRequest = {
  projectId,
  provider: "jimeng",
  promptText: "生成 8 秒产品展示视频",
  assetRefs: [],
  credentialId,
  promptDoc: { type: "doc", content: [] },
  parameters: {
    modelId: "jimeng-video-v3-720p",
    mode: "text_to_video",
    referenceMode: "none",
    aspectRatio: "16:9",
    resolution: "720p",
    durationSeconds: 5
  }
} as const;

async function buildApp(extraReadyAssetIds: string[] = []) {
  const repository = createInMemoryStudioRepository();
  const queue = createInMemoryGenerationQueue();
  await repository.createUser({ email: "creator@example.com", id: userId });
  await repository.createProject({ name: "影栈 Studio", userId, id: projectId });
  await repository.createProviderCredential({
    id: credentialId,
    userId,
    provider: "jimeng",
    displayName: "即梦主账号",
    encryptedSecret: "ciphertext",
    iv: "iviviviviviv",
    authTag: "authtagauthtag12",
    maskedLabel: "sk-****-8F2A"
  });
  await repository.createAsset({
    id: readyAssetId,
    projectId,
    userId,
    kind: "image",
    mimeType: "image/png",
    name: "包装主图",
    sizeBytes: 2048,
    tosKey: "assets/main.png",
    status: "ready"
  });
  await repository.createAsset({
    id: uploadingAssetId,
    projectId,
    userId,
    kind: "image",
    mimeType: "image/png",
    name: "上传中的主图",
    sizeBytes: 2048,
    tosKey: "assets/uploading.png",
    status: "uploading"
  });
  for (const assetId of extraReadyAssetIds) {
    await repository.createAsset({
      id: assetId,
      projectId,
      userId,
      kind: "image",
      mimeType: "image/png",
      name: "尾帧",
      sizeBytes: 2048,
      tosKey: `assets/${assetId}.png`,
      status: "ready"
    });
  }

  const app = Fastify();
  await app.register(createGenerationRoutes({ repository, queue, userId, secondConfirmSecret: "test-secret" }), { prefix: "/api" });
  return { app, queue };
}

describe("generation routes", () => {
  it("creates, lists, reads, cancels, and deletes a queued task", async () => {
    const { app, queue } = await buildApp();

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/generation/tasks",
      payload: baseRequest
    });

    expect(createResponse.statusCode).toBe(201);
    const created = createResponse.json();
    expect(created).toEqual(
      expect.objectContaining({
        projectId,
        status: "queued",
        requiresSecondConfirm: false
      })
    );
    expect(queue.jobs).toEqual([expect.objectContaining({ taskId: created.id, projectId, userId, provider: "jimeng" })]);

    const listResponse = await app.inject({ method: "GET", url: `/api/generation/tasks?projectId=${projectId}` });
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toEqual([expect.objectContaining({ id: created.id })]);

    const detailResponse = await app.inject({ method: "GET", url: `/api/generation/tasks/${created.id}` });
    expect(detailResponse.statusCode).toBe(200);
    expect(detailResponse.json()).toEqual(expect.objectContaining({ id: created.id, status: "queued" }));

    const cancelResponse = await app.inject({ method: "POST", url: `/api/generation/tasks/${created.id}/cancel` });
    expect(cancelResponse.statusCode).toBe(200);
    expect(cancelResponse.json()).toEqual(expect.objectContaining({ id: created.id, status: "canceled" }));

    const canceledListResponse = await app.inject({ method: "GET", url: `/api/generation/tasks?projectId=${projectId}` });
    expect(canceledListResponse.statusCode).toBe(200);
    expect(canceledListResponse.json()).toEqual([expect.objectContaining({ id: created.id, status: "canceled" })]);

    const deleteResponse = await app.inject({ method: "DELETE", url: `/api/generation/tasks/${created.id}` });
    expect(deleteResponse.statusCode).toBe(200);
    expect(deleteResponse.json()).toEqual(expect.objectContaining({ id: created.id, status: "canceled" }));

    const deletedListResponse = await app.inject({ method: "GET", url: `/api/generation/tasks?projectId=${projectId}` });
    expect(deletedListResponse.statusCode).toBe(200);
    expect(deletedListResponse.json()).toEqual([]);
  });

  it("returns a confirmation token and rejects high cost creation without it", async () => {
    const { app } = await buildApp();
    const highCostRequest = {
      ...baseRequest,
      promptText: "高成本生成".repeat(300),
      parameters: baseRequest.parameters
    } as const;

    const estimateResponse = await app.inject({
      method: "POST",
      url: "/api/generation/estimate",
      payload: highCostRequest
    });

    expect(estimateResponse.statusCode).toBe(200);
    expect(estimateResponse.json()).toEqual(
      expect.objectContaining({
        requiresSecondConfirm: false
      })
    );

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/generation/tasks",
      payload: highCostRequest
    });

    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.json()).toEqual(expect.objectContaining({ status: "queued", requiresSecondConfirm: false }));
  });

  it("creates and regenerates high cost tasks with a valid confirmation token", async () => {
    const { app, queue } = await buildApp();
    const highCostRequest = {
      ...baseRequest,
      promptText: "高成本生成".repeat(300),
      parameters: baseRequest.parameters
    } as const;

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/generation/tasks",
      payload: highCostRequest
    });

    expect(createResponse.statusCode).toBe(201);
    const created = createResponse.json();
    expect(created).toEqual(expect.objectContaining({ status: "queued", requiresSecondConfirm: false }));
    const estimate = await app.inject({
      method: "POST",
      url: "/api/generation/estimate",
      payload: { ...highCostRequest, sourceTaskId: created.id }
    });
    const secondConfirmToken = estimate.json().secondConfirmToken;

    const regenerateResponse = await app.inject({
      method: "POST",
      url: `/api/generation/tasks/${created.id}/regenerate`,
      payload: { ...highCostRequest, secondConfirmToken }
    });

    expect(regenerateResponse.statusCode).toBe(201);
    expect(regenerateResponse.json()).toEqual(expect.objectContaining({ status: "queued", requiresSecondConfirm: true }));
    expect(queue.jobs).toHaveLength(2);
  });

  it("requires confirmation for low cost regeneration", async () => {
    const { app } = await buildApp();

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/generation/tasks",
      payload: baseRequest
    });
    expect(createResponse.statusCode).toBe(201);
    const created = createResponse.json();

    const rejectedResponse = await app.inject({
      method: "POST",
      url: `/api/generation/tasks/${created.id}/regenerate`,
      payload: baseRequest
    });
    expect(rejectedResponse.statusCode).toBe(400);
    expect(rejectedResponse.json()).toEqual(expect.objectContaining({ error: expect.objectContaining({ code: "GENERATION_HIGH_COST_CONFIRM_REQUIRED" }) }));

    const estimateResponse = await app.inject({
      method: "POST",
      url: "/api/generation/estimate",
      payload: { ...baseRequest, sourceTaskId: created.id }
    });
    expect(estimateResponse.statusCode).toBe(200);
    expect(estimateResponse.json()).toEqual(expect.objectContaining({ requiresSecondConfirm: true, secondConfirmToken: expect.any(String) }));

    const regenerateResponse = await app.inject({
      method: "POST",
      url: `/api/generation/tasks/${created.id}/regenerate`,
      payload: { ...baseRequest, secondConfirmToken: estimateResponse.json().secondConfirmToken }
    });
    expect(regenerateResponse.statusCode).toBe(201);
    expect(regenerateResponse.json()).toEqual(expect.objectContaining({ status: "queued", requiresSecondConfirm: true }));
  });

  it("creates image and first-last-frame tasks when required images are ready", async () => {
    const { app, queue } = await buildApp();
    const imageResponse = await app.inject({
      method: "POST",
      url: "/api/generation/tasks",
      payload: {
        ...baseRequest,
        assetRefs: [{ id: readyAssetId, kind: "image", label: "包装主图" }],
        parameters: {
          ...baseRequest.parameters,
          mode: "image_to_video",
          referenceMode: "image"
        }
      }
    });
    expect(imageResponse.statusCode).toBe(201);
    expect(queue.jobs).toHaveLength(1);

    const tailAssetId = "00000000-0000-4000-8000-000000000104";
    const { app: frameApp } = await buildApp([tailAssetId]);
    const firstLastResponse = await frameApp.inject({
      method: "POST",
      url: "/api/generation/tasks",
      payload: {
        ...baseRequest,
        assetRefs: [
          { id: readyAssetId, kind: "image", label: "首帧" },
          { id: tailAssetId, kind: "image", label: "尾帧" }
        ],
        parameters: {
          ...baseRequest.parameters,
          mode: "first_last_frame",
          referenceMode: "first_last_frame"
        }
      }
    });
    expect(firstLastResponse.statusCode).toBe(201);
  });

  it("uses unified errors for unsupported capabilities, missing credentials, and unavailable assets", async () => {
    const { app } = await buildApp();

    const unsupportedResponse = await app.inject({
      method: "POST",
      url: "/api/generation/tasks",
      payload: {
        ...baseRequest,
        parameters: {
          ...baseRequest.parameters,
          durationSeconds: 15
        }
      }
    });
    expect(unsupportedResponse.statusCode).toBe(400);
    expect(unsupportedResponse.json()).toEqual(expect.objectContaining({ error: expect.objectContaining({ code: "MODEL_UNSUPPORTED_PARAMETER" }) }));

    const credentialResponse = await app.inject({
      method: "POST",
      url: "/api/generation/tasks",
      payload: { ...baseRequest, credentialId: "00000000-0000-4000-8000-000000000499" }
    });
    expect(credentialResponse.statusCode).toBe(404);
    expect(credentialResponse.json()).toEqual(expect.objectContaining({ error: expect.objectContaining({ code: "NOT_FOUND" }) }));

    const assetResponse = await app.inject({
      method: "POST",
      url: "/api/generation/tasks",
      payload: {
        ...baseRequest,
        assetRefs: [{ id: uploadingAssetId, kind: "image", label: "上传中的主图" }],
        parameters: {
          ...baseRequest.parameters,
          mode: "image_to_video",
          referenceMode: "image"
        }
      }
    });
    expect(assetResponse.statusCode).toBe(400);
    expect(assetResponse.json()).toEqual(expect.objectContaining({ error: expect.objectContaining({ code: "ASSET_NOT_READY" }) }));
  });
});
