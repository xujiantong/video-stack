import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { generationRoutes } from "./generation";

const baseRequest = {
  projectId: "00000000-0000-4000-8000-000000000001",
  provider: "jimeng",
  promptText: "高成本生成".repeat(300),
  assetRefs: [],
  credentialId: "00000000-0000-4000-8000-000000000401",
  parameters: {
    modelId: "seedance-pro",
    mode: "text_to_video",
    referenceMode: "none",
    aspectRatio: "16:9",
    resolution: "1080p",
    durationSeconds: 15
  }
} as const;

async function buildApp() {
  const app = Fastify();
  await app.register(generationRoutes, { prefix: "/api" });
  return app;
}

describe("generation routes", () => {
  it("returns a confirmation token for high cost estimates", async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/api/generation/estimate",
      payload: baseRequest
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.objectContaining({
        requiresSecondConfirm: true,
        secondConfirmToken: expect.any(String)
      })
    );
  });

  it("rejects high cost task creation without a confirmation token", async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/api/generation/tasks",
      payload: { ...baseRequest, promptDoc: { type: "doc" } }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          code: "GENERATION_HIGH_COST_CONFIRM_REQUIRED"
        })
      })
    );
  });

  it("creates a high cost task after confirmation", async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/api/generation/tasks",
      payload: {
        ...baseRequest,
        promptDoc: { type: "doc" },
        secondConfirmToken: "confirmed-high-cost"
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual(
      expect.objectContaining({
        status: "queued",
        requiresSecondConfirm: true,
        estimatedCostCents: expect.any(Number)
      })
    );
  });
});
