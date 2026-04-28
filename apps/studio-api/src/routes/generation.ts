import type { FastifyPluginAsync } from "fastify";
import {
  createGenerationRequestSchema,
  DEFAULT_GENERATION_PARAMETERS,
  DEFAULT_MODEL_CAPABILITIES,
  estimateGenerationResponseSchema,
  estimateGenerationRequestSchema,
  generationTaskSchema,
  type GenerationParameters,
  requiresSecondConfirm
} from "@video-stack/shared";

function estimateCost(input: {
  promptText: string;
  assetRefs: unknown[];
  parameters?: Pick<GenerationParameters, "modelId" | "durationSeconds"> | undefined;
}) {
  const parameters = input.parameters ?? DEFAULT_GENERATION_PARAMETERS;
  const model = DEFAULT_MODEL_CAPABILITIES.find((item) => item.id === parameters.modelId) ?? DEFAULT_MODEL_CAPABILITIES[0]!;
  const durationCostCents = parameters.durationSeconds * model.pricing.perSecondCents;
  const assetCostCents = input.assetRefs.length * model.pricing.perAssetCents;
  return {
    estimatedCostCents: Math.max(
      model.pricing.baseCostCents,
      Math.ceil(model.pricing.baseCostCents + durationCostCents + assetCostCents + input.promptText.length * 2)
    ),
    costBreakdown: {
      baseCostCents: model.pricing.baseCostCents,
      durationCostCents,
      assetCostCents
    }
  };
}

export const generationRoutes: FastifyPluginAsync = async (app) => {
  app.post("/generation/estimate", async (request) => {
    const input = estimateGenerationRequestSchema.parse(request.body);
    const estimate = estimateCost(input);
    const estimatedCostCents = estimate.estimatedCostCents;
    const secondConfirm = requiresSecondConfirm(estimatedCostCents);

    return estimateGenerationResponseSchema.parse({
      estimatedCostCents,
      estimatedSeconds: input.parameters?.durationSeconds ? input.parameters.durationSeconds * 6 : 45,
      requiresSecondConfirm: secondConfirm,
      secondConfirmToken: secondConfirm ? crypto.randomUUID().replaceAll("-", "") : undefined,
      costBreakdown: estimate.costBreakdown
    });
  });

  app.post("/generation/tasks", async (request, reply) => {
    const input = createGenerationRequestSchema.parse(request.body);
    const now = new Date().toISOString();
    const estimate = estimateCost(input);
    const needsSecondConfirm = requiresSecondConfirm(estimate.estimatedCostCents);

    if (needsSecondConfirm && !input.secondConfirmToken) {
      return reply.code(400).send({
        error: {
          code: "GENERATION_HIGH_COST_CONFIRM_REQUIRED",
          message: "本次费用较高，请确认金额后再生成。"
        }
      });
    }

    return reply.code(201).send(generationTaskSchema.parse({
      id: crypto.randomUUID(),
      projectId: input.projectId,
      provider: input.provider,
      promptDoc: input.promptDoc,
      promptText: input.promptText,
      parameters: input.parameters,
      assetRefs: input.assetRefs,
      status: "queued",
      estimatedCostCents: estimate.estimatedCostCents,
      actualCostCents: null,
      requiresSecondConfirm: needsSecondConfirm,
      resultAssetId: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now
    }));
  });
};
