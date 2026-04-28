import {
  DEFAULT_MODEL_CAPABILITIES,
  type AssetMention,
  type EstimateGenerationResponse,
  type GenerationParameters,
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
  const fallback = {
    estimatedCostCents: Math.max(
      model.pricing.baseCostCents,
      promptText.length * 2 + assetRefs.length * model.pricing.perAssetCents + parameters.durationSeconds * model.pricing.perSecondCents
    ),
    estimatedSeconds: parameters.durationSeconds * 6,
    requiresSecondConfirm: false
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
