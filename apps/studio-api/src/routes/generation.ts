import type { FastifyPluginAsync } from "fastify";
import {
  createGenerationRequestSchema,
  estimateGenerationRequestSchema,
  requiresSecondConfirm
} from "@video-stack/shared";

export const generationRoutes: FastifyPluginAsync = async (app) => {
  app.post("/generation/estimate", async (request) => {
    const input = estimateGenerationRequestSchema.parse(request.body);
    const estimatedCostCents = Math.max(300, Math.ceil(input.promptText.length * 2 + input.assetRefs.length * 120));
    const secondConfirm = requiresSecondConfirm(estimatedCostCents);

    return {
      estimatedCostCents,
      estimatedSeconds: 45,
      requiresSecondConfirm: secondConfirm,
      secondConfirmToken: secondConfirm ? crypto.randomUUID().replaceAll("-", "") : undefined
    };
  });

  app.post("/generation/tasks", async (request, reply) => {
    const input = createGenerationRequestSchema.parse(request.body);
    const now = new Date().toISOString();

    return reply.code(201).send({
      id: crypto.randomUUID(),
      projectId: input.projectId,
      provider: input.provider,
      promptText: input.promptText,
      assetRefs: input.assetRefs,
      status: "queued",
      estimatedCostCents: Math.max(300, Math.ceil(input.promptText.length * 2 + input.assetRefs.length * 120)),
      actualCostCents: null,
      requiresSecondConfirm: Boolean(input.secondConfirmToken),
      resultAssetId: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now
    });
  });
};
