import {
  DEFAULT_GENERATION_PARAMETERS,
  DEFAULT_MODEL_CAPABILITIES,
  HIGH_COST_THRESHOLD_CENTS,
  apiErrorSchema,
  type AssetMention,
  type CreateGenerationRequest,
  type EstimateGenerationResponse,
  type GenerationParameters,
  type GenerationTask,
  type ModelCapability
} from "@video-stack/shared";

export const generationTasksKey = (projectId: string) => ["generation-tasks", projectId] as const;
export const generationTaskKey = (taskId: string) => ["generation-task", taskId] as const;

const defaultProjectId = "00000000-0000-4000-8000-000000000001";

export async function listGenerationModels(): Promise<ModelCapability[]> {
  try {
    const response = await fetch("/api/models");
    if (!response.ok) return DEFAULT_MODEL_CAPABILITIES.filter((model) => model.enabled);
    return ((await response.json()) as ModelCapability[]).filter((model) => model.enabled);
  } catch {
    return DEFAULT_MODEL_CAPABILITIES.filter((model) => model.enabled);
  }
}

export async function estimateGeneration(input: {
  projectId: string;
  promptText: string;
  assetRefs: AssetMention[];
  parameters: GenerationParameters;
  sourceTaskId?: string;
}): Promise<EstimateGenerationResponse> {
  const { promptText, assetRefs, parameters } = input;
  const model = DEFAULT_MODEL_CAPABILITIES.find((item) => item.id === parameters.modelId) ?? DEFAULT_MODEL_CAPABILITIES[0]!;
  const promptCostCents =
    model.pricing.baseCostCents === 0 && model.pricing.perSecondCents === 0 && model.pricing.perAssetCents === 0 ? 0 : promptText.length * 2;
  const fallbackCostCents = Math.max(
    model.pricing.baseCostCents,
    model.pricing.baseCostCents +
      promptCostCents +
      assetRefs.length * model.pricing.perAssetCents +
      parameters.durationSeconds * model.pricing.perSecondCents
  );
  const fallbackRequiresSecondConfirm = fallbackCostCents >= HIGH_COST_THRESHOLD_CENTS || Boolean(input.sourceTaskId);
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
      body: JSON.stringify({ projectId: input.projectId, promptText, assetRefs, provider: "jimeng", parameters, sourceTaskId: input.sourceTaskId })
    });
    if (!response.ok) return fallback;
    return (await response.json()) as EstimateGenerationResponse;
  } catch {
    return fallback;
  }
}

export async function listGenerationTasks(projectId: string): Promise<GenerationTask[]> {
  const response = await fetch(`/api/generation/tasks?${new URLSearchParams({ projectId })}`);
  if (!response.ok) throw new Error(await readApiError(response, "读取任务列表失败，请刷新后重试。"));
  return (await response.json()) as GenerationTask[];
}

export async function getGenerationTask(taskId: string): Promise<GenerationTask> {
  const response = await fetch(`/api/generation/tasks/${taskId}`);
  if (!response.ok) throw new Error(await readApiError(response, "读取任务详情失败，请刷新后重试。"));
  return (await response.json()) as GenerationTask;
}

export async function createGenerationTask(
  input: CreateGenerationRequest & {
    fallbackEstimate?: Pick<EstimateGenerationResponse, "estimatedCostCents" | "requiresSecondConfirm">;
  }
): Promise<GenerationTask> {
  const response = await fetch("/api/generation/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, "创建任务失败，请检查参数后重试。"));
  }

  return (await response.json()) as GenerationTask;
}

export async function regenerateGenerationTask(
  sourceTaskId: string,
  input: CreateGenerationRequest & {
    fallbackEstimate?: Pick<EstimateGenerationResponse, "estimatedCostCents" | "requiresSecondConfirm">;
  }
): Promise<GenerationTask> {
  const response = await fetch(`/api/generation/tasks/${sourceTaskId}/regenerate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, "再次生成失败，请重新预估费用后再试。"));
  }

  return (await response.json()) as GenerationTask;
}

export async function deleteGenerationTask(taskId: string): Promise<GenerationTask> {
  const response = await fetch(`/api/generation/tasks/${taskId}`, {
    method: "DELETE"
  });
  if (!response.ok) {
    throw new Error(await readApiError(response, "删除任务失败，请稍后重试。"));
  }
  return (await response.json()) as GenerationTask;
}

async function readApiError(response: Response, fallbackMessage: string): Promise<string> {
  try {
    const parsed = apiErrorSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.error.message : fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}
