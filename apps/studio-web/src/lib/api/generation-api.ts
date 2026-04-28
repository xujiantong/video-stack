import {
  DEFAULT_MODEL_CAPABILITIES,
  HIGH_COST_THRESHOLD_CENTS,
  type AssetMention,
  type CreateGenerationRequest,
  type EstimateGenerationResponse,
  type GenerationParameters,
  type GenerationTask,
  type ModelCapability
} from "@video-stack/shared";

export async function listGenerationModels(): Promise<ModelCapability[]> {
  try {
    const response = await fetch("/api/models");
    if (!response.ok) return DEFAULT_MODEL_CAPABILITIES;
    return (await response.json()) as ModelCapability[];
  } catch {
    return DEFAULT_MODEL_CAPABILITIES;
  }
}

export async function estimateGeneration(input: {
  projectId: string;
  promptText: string;
  assetRefs: AssetMention[];
  parameters: GenerationParameters;
}): Promise<EstimateGenerationResponse> {
  const { promptText, assetRefs, parameters } = input;
  const model = DEFAULT_MODEL_CAPABILITIES.find((item) => item.id === parameters.modelId) ?? DEFAULT_MODEL_CAPABILITIES[0]!;
  const fallbackCostCents = Math.max(
    model.pricing.baseCostCents,
    model.pricing.baseCostCents +
      promptText.length * 2 +
      assetRefs.length * model.pricing.perAssetCents +
      parameters.durationSeconds * model.pricing.perSecondCents
  );
  const fallbackRequiresSecondConfirm = fallbackCostCents >= HIGH_COST_THRESHOLD_CENTS;
  const fallback = {
    estimatedCostCents: fallbackCostCents,
    estimatedSeconds: parameters.durationSeconds * 6,
    requiresSecondConfirm: fallbackRequiresSecondConfirm,
    secondConfirmToken: fallbackRequiresSecondConfirm ? crypto.randomUUID().replaceAll("-", "") : undefined
  };

  try {
    const response = await fetch("/api/generation/estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: input.projectId, promptText, assetRefs, provider: "jimeng", parameters })
    });
    if (!response.ok) return fallback;
    return (await response.json()) as EstimateGenerationResponse;
  } catch {
    return fallback;
  }
}

export async function createGenerationTask(
  input: CreateGenerationRequest & {
    fallbackEstimate?: Pick<EstimateGenerationResponse, "estimatedCostCents" | "requiresSecondConfirm">;
  }
): Promise<GenerationTask> {
  let response: Response;
  try {
    response = await fetch("/api/generation/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    });
  } catch {
    const now = new Date().toISOString();
    return {
      id: crypto.randomUUID(),
      projectId: input.projectId,
      provider: input.provider,
      promptDoc: input.promptDoc,
      promptText: input.promptText,
      parameters: input.parameters,
      assetRefs: input.assetRefs,
      status: "queued",
      estimatedCostCents: input.fallbackEstimate?.estimatedCostCents ?? Math.max(300, input.promptText.length * 2),
      actualCostCents: null,
      requiresSecondConfirm: input.fallbackEstimate?.requiresSecondConfirm ?? false,
      resultAssetId: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now
    };
  }

  if (!response.ok) {
    throw new Error("创建任务失败，请检查参数后重试。");
  }

  return (await response.json()) as GenerationTask;
}
