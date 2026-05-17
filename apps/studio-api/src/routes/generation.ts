import { createHash, createHmac } from "node:crypto";
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { ZodError } from "zod";
import {
  apiErrorSchema,
  createGenerationRequestSchema,
  DEFAULT_GENERATION_PARAMETERS,
  DEFAULT_MODEL_CAPABILITIES,
  estimateGenerationResponseSchema,
  estimateGenerationRequestSchema,
  expectedImageAssetCount,
  generationTaskParamsSchema,
  generationTaskSchema,
  listGenerationTasksQuerySchema,
  modelSupportsParameters,
  regenerateGenerationRequestSchema,
  requiresSecondConfirm,
  type CreateGenerationRequest,
  type ErrorCode,
  type GenerationParameters,
  type GenerationTask,
  type RegenerateGenerationRequest
} from "@video-stack/shared";
import { createInMemoryStudioRepository, type GenerationTaskRecord, type StudioRepository } from "../db/repositories";
import { createInMemoryGenerationQueue, type GenerationQueue } from "../queue/generation-queue";

const defaultUserId = "00000000-0000-4000-8000-000000000501";
const defaultProjectId = "00000000-0000-4000-8000-000000000001";
const defaultCredentialId = "00000000-0000-4000-8000-000000000401";
const defaultSecondConfirmSecret = "local-generation-second-confirm";

type GenerationRouteDeps = {
  repository: StudioRepository;
  queue: GenerationQueue;
  userId: string;
  secondConfirmSecret?: string;
  init?: () => Promise<void>;
};

type ValidatedGenerationInput = CreateGenerationRequest | RegenerateGenerationRequest;

function estimateCost(input: {
  promptText: string;
  assetRefs: unknown[];
  parameters?: Pick<GenerationParameters, "modelId" | "durationSeconds"> | undefined;
}) {
  const parameters = input.parameters ?? DEFAULT_GENERATION_PARAMETERS;
  const model = DEFAULT_MODEL_CAPABILITIES.find((item) => item.id === parameters.modelId) ?? DEFAULT_MODEL_CAPABILITIES[0]!;
  const durationCostCents = parameters.durationSeconds * model.pricing.perSecondCents;
  const assetCostCents = input.assetRefs.length * model.pricing.perAssetCents;
  const promptCostCents =
    model.pricing.baseCostCents === 0 && model.pricing.perSecondCents === 0 && model.pricing.perAssetCents === 0 ? 0 : input.promptText.length * 2;
  return {
    estimatedCostCents: Math.max(
      model.pricing.baseCostCents,
      Math.ceil(model.pricing.baseCostCents + durationCostCents + assetCostCents + promptCostCents)
    ),
    costBreakdown: {
      baseCostCents: model.pricing.baseCostCents,
      durationCostCents,
      assetCostCents
    }
  };
}

export function createGenerationRoutes(deps: GenerationRouteDeps): FastifyPluginAsync {
  const secondConfirmSecret = deps.secondConfirmSecret ?? defaultSecondConfirmSecret;

  return async (app) => {
    app.post("/generation/estimate", async (request, reply) => {
      try {
        await deps.init?.();
        const input = estimateGenerationRequestSchema.parse(request.body);
        await validateModelAndAssets(deps.repository, input);
        const estimate = estimateCost(input);
        const secondConfirm = requiresSecondConfirm(estimate.estimatedCostCents) || Boolean(input.sourceTaskId);

        return estimateGenerationResponseSchema.parse({
          estimatedCostCents: estimate.estimatedCostCents,
          estimatedSeconds: input.parameters?.durationSeconds ? input.parameters.durationSeconds * 6 : 45,
          requiresSecondConfirm: secondConfirm,
          secondConfirmToken: secondConfirm ? createSecondConfirmToken(input, estimate.estimatedCostCents, secondConfirmSecret) : undefined,
          costBreakdown: estimate.costBreakdown
        });
      } catch (error) {
        return sendError(reply, error, "费用预估失败，请检查参数后重试。");
      }
    });

    app.post("/generation/tasks", async (request, reply) => {
      try {
        await deps.init?.();
        const input = createGenerationRequestSchema.parse(request.body);
        const task = await createQueuedTask(deps, input, secondConfirmSecret);
        return reply.code(201).send(toPublicTask(task));
      } catch (error) {
        return sendError(reply, error, "创建任务失败，请检查参数后重试。");
      }
    });

    app.get("/generation/tasks", async (request, reply) => {
      try {
        await deps.init?.();
        const query = listGenerationTasksQuerySchema.parse(request.query);
        const tasks = await deps.repository.listGenerationTasks(query.projectId);
        return reply.send(tasks.map(toPublicTask));
      } catch (error) {
        return sendError(reply, error, "读取任务列表失败，请刷新后重试。");
      }
    });

    app.get("/generation/tasks/:taskId", async (request, reply) => {
      try {
        await deps.init?.();
        const { taskId } = generationTaskParamsSchema.parse(request.params);
        const task = await deps.repository.getGenerationTask(taskId);
        return reply.send(toPublicTask(task));
      } catch (error) {
        return sendError(reply, error, "读取任务详情失败，请刷新后重试。");
      }
    });

    app.post("/generation/tasks/:taskId/cancel", async (request, reply) => {
      try {
        await deps.init?.();
        const { taskId } = generationTaskParamsSchema.parse(request.params);
        const task = await deps.repository.cancelGenerationTask(taskId);
        return reply.send(toPublicTask(task));
      } catch (error) {
        return sendError(reply, error, "取消任务失败，请稍后重试。");
      }
    });

    app.delete("/generation/tasks/:taskId", async (request, reply) => {
      try {
        await deps.init?.();
        const { taskId } = generationTaskParamsSchema.parse(request.params);
        const task = await deps.repository.softDeleteGenerationTask(taskId);
        return reply.send(toPublicTask(task));
      } catch (error) {
        return sendError(reply, error, "删除任务失败，请稍后重试。");
      }
    });

    app.post("/generation/tasks/:taskId/regenerate", async (request, reply) => {
      try {
        await deps.init?.();
        const { taskId } = generationTaskParamsSchema.parse(request.params);
        await deps.repository.getGenerationTask(taskId);
        const input = regenerateGenerationRequestSchema.parse({ ...(request.body as object), sourceTaskId: taskId });
        const task = await createQueuedTask(deps, input, secondConfirmSecret);
        return reply.code(201).send(toPublicTask(task));
      } catch (error) {
        return sendError(reply, error, "再次生成失败，请检查参数后重试。");
      }
    });

    app.post("/generations/estimate", async (request, reply) => {
      try {
        await deps.init?.();
        const input = estimateGenerationRequestSchema.parse(request.body);
        await validateModelAndAssets(deps.repository, input);
        const estimate = estimateCost(input);
        const secondConfirm = requiresSecondConfirm(estimate.estimatedCostCents) || Boolean(input.sourceTaskId);

        return estimateGenerationResponseSchema.parse({
          estimatedCostCents: estimate.estimatedCostCents,
          estimatedSeconds: input.parameters?.durationSeconds ? input.parameters.durationSeconds * 6 : 45,
          requiresSecondConfirm: secondConfirm,
          secondConfirmToken: secondConfirm ? createSecondConfirmToken(input, estimate.estimatedCostCents, secondConfirmSecret) : undefined,
          costBreakdown: estimate.costBreakdown
        });
      } catch (error) {
        return sendError(reply, error, "费用预估失败，请检查参数后重试。");
      }
    });

    app.post("/generations", async (request, reply) => {
      try {
        await deps.init?.();
        const input = createGenerationRequestSchema.parse(request.body);
        const task = await createQueuedTask(deps, input, secondConfirmSecret);
        return reply.code(201).send(toPublicTask(task));
      } catch (error) {
        return sendError(reply, error, "创建任务失败，请检查参数后重试。");
      }
    });

    app.get("/generations/:taskId", async (request, reply) => {
      try {
        await deps.init?.();
        const { taskId } = generationTaskParamsSchema.parse(request.params);
        const task = await deps.repository.getGenerationTask(taskId);
        return reply.send(toPublicTask(task));
      } catch (error) {
        return sendError(reply, error, "读取任务详情失败，请刷新后重试。");
      }
    });

    app.get("/projects/:projectId/generations", async (request, reply) => {
      try {
        await deps.init?.();
        const { projectId } = listGenerationTasksQuerySchema.parse(request.params);
        const tasks = await deps.repository.listGenerationTasks(projectId);
        return reply.send(tasks.map(toPublicTask));
      } catch (error) {
        return sendError(reply, error, "读取任务列表失败，请刷新后重试。");
      }
    });

    app.post("/generations/:taskId/cancel", async (request, reply) => {
      try {
        await deps.init?.();
        const { taskId } = generationTaskParamsSchema.parse(request.params);
        const task = await deps.repository.cancelGenerationTask(taskId);
        return reply.send(toPublicTask(task));
      } catch (error) {
        return sendError(reply, error, "取消任务失败，请稍后重试。");
      }
    });

    app.delete("/generations/:taskId", async (request, reply) => {
      try {
        await deps.init?.();
        const { taskId } = generationTaskParamsSchema.parse(request.params);
        const task = await deps.repository.softDeleteGenerationTask(taskId);
        return reply.send(toPublicTask(task));
      } catch (error) {
        return sendError(reply, error, "删除任务失败，请稍后重试。");
      }
    });

    app.post("/generations/:taskId/regenerate", async (request, reply) => {
      try {
        await deps.init?.();
        const { taskId } = generationTaskParamsSchema.parse(request.params);
        await deps.repository.getGenerationTask(taskId);
        const input = regenerateGenerationRequestSchema.parse({ ...(request.body as object), sourceTaskId: taskId });
        const task = await createQueuedTask(deps, input, secondConfirmSecret);
        return reply.code(201).send(toPublicTask(task));
      } catch (error) {
        return sendError(reply, error, "再次生成失败，请检查参数后重试。");
      }
    });

  };
}

async function createQueuedTask(deps: GenerationRouteDeps, input: ValidatedGenerationInput, secondConfirmSecret: string) {
  await validateCredential(deps.repository, deps.userId, input);
  await validateModelAndAssets(deps.repository, input);
  const estimate = estimateCost(input);
  validateSecondConfirm(input, estimate.estimatedCostCents, secondConfirmSecret);

  const task = await deps.repository.createGenerationTask({
    projectId: input.projectId,
    userId: deps.userId,
    provider: input.provider,
    promptDoc: input.promptDoc ?? { type: "doc", content: [] },
    promptText: input.promptText,
    parameters: input.parameters ?? DEFAULT_GENERATION_PARAMETERS,
    assetRefs: input.assetRefs,
    status: "queued",
    estimatedCostCents: estimate.estimatedCostCents,
    requiresSecondConfirm: requiresSecondConfirm(estimate.estimatedCostCents) || "sourceTaskId" in input
  });

  await deps.queue.enqueue({
    taskId: task.id,
    userId: task.userId,
    projectId: task.projectId,
    provider: task.provider,
    attempt: 1
  });

  return task;
}

async function validateCredential(repository: StudioRepository, userId: string, input: ValidatedGenerationInput) {
  const credential = await repository.getProviderCredential(input.credentialId);
  if (credential.userId !== userId || credential.provider !== input.provider) {
    throw apiError("CREDENTIAL_INVALID", "请选择当前项目可用的即梦凭证。");
  }
}

async function validateModelAndAssets(
  repository: StudioRepository,
  input: Pick<CreateGenerationRequest, "projectId" | "provider" | "parameters" | "assetRefs" | "promptText">
) {
  const parameters = input.parameters ?? DEFAULT_GENERATION_PARAMETERS;
  const model = DEFAULT_MODEL_CAPABILITIES.find((item) => item.id === parameters.modelId && item.provider === input.provider && item.enabled);
  if (!model) {
    throw apiError("MODEL_NOT_FOUND", "未找到所选模型，请重新选择模型。", 404);
  }
  if (input.promptText.length > model.maxPromptLength) {
    throw apiError("VALIDATION_ERROR", "提示词超过模型限制，请删减后再生成。");
  }
  if (!modelSupportsParameters({ capability: model, parameters, assetRefs: input.assetRefs })) {
    throw apiError("MODEL_UNSUPPORTED_PARAMETER", "当前模型不支持这些参数，请调整模型、比例、分辨率或时长。");
  }

  const expectedImages = expectedImageAssetCount(parameters);
  const imageRefs = input.assetRefs.filter((asset) => asset.kind === "image");
  if (input.assetRefs.length !== imageRefs.length || imageRefs.length !== expectedImages) {
    throw apiError("MODEL_UNSUPPORTED_ASSET", assetRequirementMessage(expectedImages));
  }

  for (const assetRef of input.assetRefs) {
    const asset = await repository.getAsset(assetRef.id);
    if (asset.projectId !== input.projectId) {
      throw apiError("FORBIDDEN", "素材不属于当前项目，请重新选择参考内容。", 403);
    }
    if (asset.status !== "ready") {
      throw apiError("ASSET_NOT_READY", "素材仍在上传或已失效，请等待上传完成后再生成。");
    }
    if (asset.kind !== assetRef.kind) {
      throw apiError("MODEL_UNSUPPORTED_ASSET", "素材类型和引用不一致，请重新选择参考内容。");
    }
  }
}

function assetRequirementMessage(expectedImages: number): string {
  if (expectedImages === 0) return "文生视频不需要参考素材，请移除已引用素材。";
  if (expectedImages === 1) return "当前生成类型需要引用 1 张已上传图片。";
  return "首尾帧生成需要按顺序引用 2 张已上传图片。";
}

function validateSecondConfirm(input: ValidatedGenerationInput, estimatedCostCents: number, secret: string) {
  const requiresConfirm = requiresSecondConfirm(estimatedCostCents) || "sourceTaskId" in input;
  if (!requiresConfirm) return;
  if (!input.secondConfirmToken) {
    throw apiError("GENERATION_HIGH_COST_CONFIRM_REQUIRED", "本次预计费用较高，请确认金额后再生成。");
  }
  if (!verifySecondConfirmToken(input, estimatedCostCents, input.secondConfirmToken, secret)) {
    throw apiError("GENERATION_SECOND_CONFIRM_INVALID", "确认已失效，请重新预估费用后再生成。");
  }
}

function createSecondConfirmToken(input: object, estimatedCostCents: number, secret: string): string {
  const payload = {
    hash: hashGenerationInput(input, estimatedCostCents),
    expiresAt: Date.now() + 10 * 60 * 1000
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}

function verifySecondConfirmToken(input: object, estimatedCostCents: number, token: string, secret: string): boolean {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return false;
  const expectedSignature = createHmac("sha256", secret).update(encodedPayload).digest("base64url");
  if (signature !== expectedSignature) return false;

  try {
    const parsed = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as { hash?: string; expiresAt?: number };
    return parsed.hash === hashGenerationInput(input, estimatedCostCents) && typeof parsed.expiresAt === "number" && parsed.expiresAt > Date.now();
  } catch {
    return false;
  }
}

function hashGenerationInput(input: object, estimatedCostCents: number): string {
  const subject = input as Partial<CreateGenerationRequest>;
  return createHash("sha256")
    .update(
      canonicalize({
        projectId: subject.projectId,
        provider: subject.provider,
        promptText: subject.promptText,
        assetRefs: subject.assetRefs,
        parameters: subject.parameters ?? DEFAULT_GENERATION_PARAMETERS,
        estimatedCostCents
      })
    )
    .digest("base64url");
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  return `{${Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`)
    .join(",")}}`;
}

function toPublicTask(record: GenerationTaskRecord): GenerationTask {
  return generationTaskSchema.parse({
    id: record.id,
    projectId: record.projectId,
    userId: record.userId,
    provider: record.provider,
    promptDoc: record.promptDoc,
    promptText: record.promptText,
    parameters: record.parameters ?? undefined,
    assetRefs: record.assetRefs,
    status: record.status,
    estimatedCostCents: record.estimatedCostCents,
    actualCostCents: record.actualCostCents,
    requiresSecondConfirm: record.requiresSecondConfirm,
    providerTaskId: record.providerTaskId,
    resultAssetId: record.resultAssetId,
    errorCode: record.errorCode,
    errorMessage: record.errorMessage,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    startedAt: record.startedAt?.toISOString() ?? null,
    finishedAt: record.finishedAt?.toISOString() ?? null
  });
}

function apiError(code: ErrorCode, message: string, status = 400, details?: Record<string, unknown>) {
  return Object.assign(apiErrorSchema.parse({ error: { code, message, details } }), { status });
}

function sendError(reply: FastifyReply, error: unknown, fallbackMessage: string) {
  if (error instanceof ZodError) {
    return reply.code(400).send(apiErrorSchema.parse({ error: { code: "VALIDATION_ERROR", message: "请求参数无效，请检查后重试。" } }));
  }
  if (error instanceof Error && error.message === "GENERATION_TASK_NOT_CANCELABLE") {
    return reply
      .code(400)
      .send(apiErrorSchema.parse({ error: { code: "GENERATION_TASK_NOT_CANCELABLE", message: "任务已结束，不能取消。" } }));
  }

  const parsed = apiErrorSchema.safeParse(error);
  if (parsed.success) {
    const status = "status" in Object(error) && typeof Object(error).status === "number" ? Object(error).status : statusForCode(parsed.data.error.code);
    return reply.code(status).send(parsed.data);
  }

  if (error instanceof Error && error.message.includes("不存在")) {
    return reply.code(404).send(apiErrorSchema.parse({ error: { code: "NOT_FOUND", message: error.message } }));
  }

  return reply.code(500).send(apiErrorSchema.parse({ error: { code: "INTERNAL_ERROR", message: fallbackMessage } }));
}

function statusForCode(code: ErrorCode): number {
  if (code === "NOT_FOUND" || code === "MODEL_NOT_FOUND") return 404;
  if (code === "FORBIDDEN") return 403;
  return 400;
}

const defaultRepository = createInMemoryStudioRepository();
const defaultQueue = createInMemoryGenerationQueue();
let seeded = false;

async function seedDefaultRepository() {
  if (seeded) return;
  seeded = true;
  await defaultRepository.createUser({ email: "local@studio.internal", id: defaultUserId });
  await defaultRepository.createProject({ id: defaultProjectId, userId: defaultUserId, name: "影栈 Studio" });
  await defaultRepository.createProviderCredential({
    id: defaultCredentialId,
    userId: defaultUserId,
    provider: "jimeng",
    displayName: "即梦本地凭证",
    encryptedSecret: "local",
    iv: "local-iv",
    authTag: "local-auth-tag",
    maskedLabel: "sk-****-local"
  });
}

export const generationRoutes = createGenerationRoutes({
  repository: defaultRepository,
  queue: defaultQueue,
  userId: defaultUserId,
  init: seedDefaultRepository
});
