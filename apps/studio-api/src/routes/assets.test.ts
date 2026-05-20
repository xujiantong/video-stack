import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { createInMemoryStudioRepository } from "../db/repositories";
import { createAssetRoutes } from "./assets";
import { createAssetService } from "../services/asset-service";
import { createStorageService } from "../services/storage-service";

const userId = "00000000-0000-4000-8000-000000000501";
const projectId = "00000000-0000-4000-8000-000000000001";
const assetId = "00000000-0000-4000-8000-000000000101";
const now = new Date("2026-04-28T07:45:31.309Z");

async function buildAssetTestServer() {
  const app = Fastify();
  const repository = createInMemoryStudioRepository({
    idFactory: () => assetId,
    now: () => now
  });
  await repository.createUser({ email: "local@studio.internal", id: userId });
  await repository.createProject({ id: projectId, userId, name: "影栈 Studio" });

  const storage = createStorageService({
    DATABASE_URL: "postgres://studio:studio@localhost:5432/studio",
    REDIS_URL: "redis://localhost:6379",
    STUDIO_SECRET_KEY_BASE64: Buffer.alloc(32).toString("base64"),
    STUDIO_STORAGE_MODE: "local",
    STUDIO_STORAGE_BUCKET: "studio-assets",
    STUDIO_S3_REGION: "auto",
    STUDIO_GENERATION_MODE: "inline",
    JIMENG_REQ_KEY: "jimeng_t2v_v30",
    PORT: 4000
  });
  const service = createAssetService({ repository, storage, userId, now: () => now, idFactory: () => assetId });
  await app.register(createAssetRoutes(service), { prefix: "/api" });
  return app;
}

describe("asset routes", () => {
  it("presigns upload, accepts bytes, and completes asset", async () => {
    const app = await buildAssetTestServer();

    const presignResponse = await app.inject({
      method: "POST",
      url: "/api/assets/presign",
      payload: {
        projectId,
        fileName: "demo.png",
        mimeType: "image/png",
        sizeBytes: 1024,
        durationMs: null
      }
    });

    expect(presignResponse.statusCode).toBe(201);
    const presignBody = presignResponse.json<{
      assetId: string;
      uploadUrl: string;
      storageKey: string;
    }>();
    expect(presignBody.assetId).toBe(assetId);
    expect(presignBody.uploadUrl).toContain("/api/assets/uploads/");
    expect(presignBody.storageKey).toContain(projectId);

    const uploadResponse = await app.inject({
      method: "PUT",
      url: presignBody.uploadUrl,
      headers: { "content-type": "image/png" },
      payload: Buffer.from("hello")
    });
    expect(uploadResponse.statusCode).toBe(200);

    const completeResponse = await app.inject({
      method: "POST",
      url: "/api/assets/complete",
      payload: {
        assetId,
        projectId,
        storageKey: presignBody.storageKey
      }
    });

    expect(completeResponse.statusCode).toBe(201);
    const asset = completeResponse.json<{ id: string; status: string; storageKey: string }>();
    expect(asset.id).toBe(assetId);
    expect(asset.status).toBe("ready");
    expect(asset.storageKey).toBe(presignBody.storageKey);
  });

  it("serves asset content with HTTP range support", async () => {
    const app = await buildAssetTestServer();
    const presignResponse = await app.inject({
      method: "POST",
      url: "/api/assets/presign",
      payload: {
        projectId,
        fileName: "demo.mp4",
        mimeType: "video/mp4",
        sizeBytes: 11,
        durationMs: 1_000
      }
    });
    const presignBody = presignResponse.json<{
      assetId: string;
      uploadUrl: string;
      storageKey: string;
    }>();
    await app.inject({
      method: "PUT",
      url: presignBody.uploadUrl,
      headers: { "content-type": "video/mp4" },
      payload: Buffer.from("hello world")
    });
    await app.inject({
      method: "POST",
      url: "/api/assets/complete",
      payload: {
        assetId,
        projectId,
        storageKey: presignBody.storageKey
      }
    });

    const rangeResponse = await app.inject({
      method: "GET",
      url: `/api/assets/${assetId}/content`,
      headers: { range: "bytes=0-4" }
    });

    expect(rangeResponse.statusCode).toBe(206);
    expect(rangeResponse.headers["accept-ranges"]).toBe("bytes");
    expect(rangeResponse.headers["content-range"]).toBe("bytes 0-4/11");
    expect(rangeResponse.headers["content-length"]).toBe("5");
    expect(rangeResponse.body).toBe("hello");
  });

  it("rejects unsatisfiable asset content ranges", async () => {
    const app = await buildAssetTestServer();
    const presignResponse = await app.inject({
      method: "POST",
      url: "/api/assets/presign",
      payload: {
        projectId,
        fileName: "demo.mp4",
        mimeType: "video/mp4",
        sizeBytes: 5,
        durationMs: 1_000
      }
    });
    const presignBody = presignResponse.json<{
      assetId: string;
      uploadUrl: string;
      storageKey: string;
    }>();
    await app.inject({
      method: "PUT",
      url: presignBody.uploadUrl,
      headers: { "content-type": "video/mp4" },
      payload: Buffer.from("hello")
    });
    await app.inject({
      method: "POST",
      url: "/api/assets/complete",
      payload: {
        assetId,
        projectId,
        storageKey: presignBody.storageKey
      }
    });

    const rangeResponse = await app.inject({
      method: "GET",
      url: `/api/assets/${assetId}/content`,
      headers: { range: "bytes=9-10" }
    });

    expect(rangeResponse.statusCode).toBe(416);
    expect(rangeResponse.headers["content-range"]).toBe("bytes */5");
  });
});
