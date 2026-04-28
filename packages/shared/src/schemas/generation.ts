import { z } from "zod";
import { GENERATION_STATUSES, HIGH_COST_THRESHOLD_CENTS, MAX_ASSET_REFS, MAX_PROMPT_LENGTH, SECOND_CONFIRM_TOKEN_MIN_LENGTH } from "../constants";
import { assetMentionSchema } from "./assets";
import { errorCodeSchema } from "./errors";
import { generationParametersSchema, providerSchema } from "./models";

export const generationStatusSchema = z.enum(GENERATION_STATUSES);

export const estimateGenerationRequestSchema = z.object({
  projectId: z.string().uuid(),
  promptText: z.string().min(1).max(MAX_PROMPT_LENGTH),
  assetRefs: z.array(assetMentionSchema).max(MAX_ASSET_REFS),
  provider: providerSchema,
  parameters: generationParametersSchema.optional(),
  sourceTaskId: z.string().uuid().optional()
});

export const estimateGenerationResponseSchema = z.object({
  estimatedCostCents: z.number().int().nonnegative(),
  estimatedSeconds: z.number().int().positive(),
  requiresSecondConfirm: z.boolean(),
  secondConfirmToken: z.string().min(SECOND_CONFIRM_TOKEN_MIN_LENGTH).optional(),
  costBreakdown: z
    .object({
      baseCostCents: z.number().int().nonnegative(),
      durationCostCents: z.number().int().nonnegative(),
      assetCostCents: z.number().int().nonnegative()
    })
    .optional()
});

export const createGenerationRequestSchema = estimateGenerationRequestSchema.extend({
  promptDoc: z.record(z.unknown()).optional(),
  credentialId: z.string().uuid(),
  secondConfirmToken: z.string().min(SECOND_CONFIRM_TOKEN_MIN_LENGTH).optional()
});

export const regenerateGenerationRequestSchema = createGenerationRequestSchema.extend({
  sourceTaskId: z.string().uuid()
});

export const listGenerationTasksQuerySchema = z.object({
  projectId: z.string().uuid()
});

export const generationTaskParamsSchema = z.object({
  taskId: z.string().uuid()
});

export const generationTaskSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  userId: z.string().uuid().optional(),
  provider: providerSchema,
  promptDoc: z.record(z.unknown()).optional(),
  promptText: z.string().min(1).max(MAX_PROMPT_LENGTH),
  parameters: generationParametersSchema.optional(),
  assetRefs: z.array(assetMentionSchema),
  status: generationStatusSchema,
  estimatedCostCents: z.number().int().nonnegative(),
  actualCostCents: z.number().int().nonnegative().nullable(),
  requiresSecondConfirm: z.boolean(),
  providerTaskId: z.string().min(1).nullable().optional(),
  resultAssetId: z.string().uuid().nullable(),
  errorCode: errorCodeSchema.nullable().optional(),
  errorMessage: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable().optional(),
  finishedAt: z.string().datetime().nullable().optional()
});

export const generationJobPayloadSchema = z.object({
  taskId: z.string().uuid(),
  userId: z.string().uuid(),
  projectId: z.string().uuid(),
  provider: providerSchema,
  attempt: z.number().int().min(1).max(3)
});

export function requiresSecondConfirm(estimatedCostCents: number): boolean {
  return estimatedCostCents >= HIGH_COST_THRESHOLD_CENTS;
}

export type EstimateGenerationRequest = z.infer<typeof estimateGenerationRequestSchema>;
export type EstimateGenerationResponse = z.infer<typeof estimateGenerationResponseSchema>;
export type CreateGenerationRequest = z.infer<typeof createGenerationRequestSchema>;
export type RegenerateGenerationRequest = z.infer<typeof regenerateGenerationRequestSchema>;
export type ListGenerationTasksQuery = z.infer<typeof listGenerationTasksQuerySchema>;
export type GenerationTask = z.infer<typeof generationTaskSchema>;
export type GenerationJobPayload = z.infer<typeof generationJobPayloadSchema>;
