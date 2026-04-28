import { z } from "zod";
import { GENERATION_STATUSES, HIGH_COST_THRESHOLD_CENTS } from "../constants";

export const generationStatusSchema = z.enum(GENERATION_STATUSES);

export const assetMentionSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(["image", "video", "audio"]),
  label: z.string().min(1).max(80)
});

export const estimateGenerationRequestSchema = z.object({
  projectId: z.string().uuid(),
  promptText: z.string().min(1).max(4000),
  assetRefs: z.array(assetMentionSchema).max(20),
  provider: z.literal("jimeng")
});

export const estimateGenerationResponseSchema = z.object({
  estimatedCostCents: z.number().int().nonnegative(),
  estimatedSeconds: z.number().int().positive(),
  requiresSecondConfirm: z.boolean(),
  secondConfirmToken: z.string().min(16).optional()
});

export const createGenerationRequestSchema = estimateGenerationRequestSchema.extend({
  promptDoc: z.record(z.unknown()),
  credentialId: z.string().uuid(),
  secondConfirmToken: z.string().min(16).optional()
});

export const generationTaskSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  provider: z.literal("jimeng"),
  promptText: z.string(),
  assetRefs: z.array(assetMentionSchema),
  status: generationStatusSchema,
  estimatedCostCents: z.number().int().nonnegative(),
  actualCostCents: z.number().int().nonnegative().nullable(),
  requiresSecondConfirm: z.boolean(),
  resultAssetId: z.string().uuid().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export function requiresSecondConfirm(estimatedCostCents: number): boolean {
  return estimatedCostCents >= HIGH_COST_THRESHOLD_CENTS;
}

export type AssetMention = z.infer<typeof assetMentionSchema>;
export type EstimateGenerationRequest = z.infer<typeof estimateGenerationRequestSchema>;
export type EstimateGenerationResponse = z.infer<typeof estimateGenerationResponseSchema>;
export type CreateGenerationRequest = z.infer<typeof createGenerationRequestSchema>;
export type GenerationTask = z.infer<typeof generationTaskSchema>;
