import {
  DEFAULT_GENERATION_PARAMETERS,
  DEFAULT_MODEL_CAPABILITIES,
  HIGH_COST_THRESHOLD_CENTS,
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
const mockNow = new Date().toISOString();
const mockTasks: GenerationTask[] = [
  {
    id: "00000000-0000-4000-8000-000000000201",
    projectId: defaultProjectId,
    provider: "jimeng",
    promptText: "生成 8 秒产品展示视频",
    parameters: DEFAULT_GENERATION_PARAMETERS,
    assetRefs: [],
    status: "succeeded",
    estimatedCostCents: 860,
    actualCostCents: 860,
    requiresSecondConfirm: false,
    resultAssetId: "00000000-0000-4000-8000-000000000301",
    errorMessage: null,
    createdAt: mockNow,
    updatedAt: mockNow
  },
  {
    id: "00000000-0000-4000-8000-000000000202",
    projectId: defaultProjectId,
    provider: "jimeng",
    promptText: "把镜头改成俯拍，增加字幕",
    parameters: DEFAULT_GENERATION_PARAMETERS,
    assetRefs: [],
    status: "running",
    estimatedCostCents: 1120,
    actualCostCents: null,
    requiresSecondConfirm: false,
    resultAssetId: null,
    errorMessage: null,
    createdAt: mockNow,
    updatedAt: mockNow
  },
  {
    id: "00000000-0000-4000-8000-000000000203",
    projectId: defaultProjectId,
    provider: "jimeng",
    promptText: "使用 @包装主图 展示产品旋转，镜头从微距拉到全景。",
    parameters: DEFAULT_GENERATION_PARAMETERS,
    assetRefs: [],
    status: "queued",
    estimatedCostCents: 1480,
    actualCostCents: null,
    requiresSecondConfirm: false,
    resultAssetId: null,
    errorMessage: null,
    createdAt: mockNow,
    updatedAt: mockNow
  },
  {
    id: "00000000-0000-4000-8000-000000000204",
    projectId: defaultProjectId,
    provider: "jimeng",
    promptText: "当前模型不支持音频参考，请移除 @旁白音色 或切换模型。",
    parameters: DEFAULT_GENERATION_PARAMETERS,
    assetRefs: [],
    status: "failed",
    estimatedCostCents: 980,
    actualCostCents: null,
    requiresSecondConfirm: false,
    resultAssetId: null,
    errorMessage: "当前模型不支持音频参考，请移除音频或切换模型。",
    createdAt: mockNow,
    updatedAt: mockNow
  }
];
const mockDetailReads = new Map<string, number>();

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

export async function listGenerationTasks(projectId: string): Promise<GenerationTask[]> {
  try {
    const response = await fetch(`/api/generation/tasks?${new URLSearchParams({ projectId })}`);
    if (!response.ok) throw new Error("读取任务列表失败，请刷新后重试。");
    return (await response.json()) as GenerationTask[];
  } catch {
    return mockTasks.filter((task) => task.projectId === projectId);
  }
}

export async function getGenerationTask(taskId: string): Promise<GenerationTask> {
  try {
    const response = await fetch(`/api/generation/tasks/${taskId}`);
    if (!response.ok) throw new Error("读取任务详情失败，请刷新后重试。");
    return (await response.json()) as GenerationTask;
  } catch {
    const task = mockTasks.find((item) => item.id === taskId);
    if (!task) throw new Error("任务不存在，请刷新后重试。");
    const reads = (mockDetailReads.get(taskId) ?? 0) + 1;
    mockDetailReads.set(taskId, reads);
    if (task.status === "running" && reads > 1) {
      const updated = {
        ...task,
        status: "succeeded" as const,
        actualCostCents: task.estimatedCostCents,
        resultAssetId: "00000000-0000-4000-8000-000000000302",
        updatedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString()
      };
      const index = mockTasks.findIndex((item) => item.id === taskId);
      if (index >= 0) mockTasks[index] = updated;
      return updated;
    }
    return task;
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
    const task: GenerationTask = {
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
    mockTasks.unshift(task);
    return task;
  }

  if (!response.ok) {
    throw new Error("创建任务失败，请检查参数后重试。");
  }

  return (await response.json()) as GenerationTask;
}
