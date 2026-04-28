import { z } from "zod";
import {
  ASPECT_RATIOS,
  GENERATION_MODES,
  MAX_ASSET_REFS,
  MAX_PROMPT_LENGTH,
  PROVIDERS,
  REFERENCE_MODES,
  VIDEO_DURATIONS_SECONDS,
  VIDEO_RESOLUTIONS
} from "../constants";
import { assetMentionSchema } from "./assets";

export const providerSchema = z.enum(PROVIDERS);
export const generationModeSchema = z.enum(GENERATION_MODES);
export const referenceModeSchema = z.enum(REFERENCE_MODES);
export const aspectRatioSchema = z.enum(ASPECT_RATIOS);
export const videoResolutionSchema = z.enum(VIDEO_RESOLUTIONS);
export const videoDurationSecondsSchema = z.union([
  z.literal(VIDEO_DURATIONS_SECONDS[0]),
  z.literal(VIDEO_DURATIONS_SECONDS[1]),
  z.literal(VIDEO_DURATIONS_SECONDS[2])
]);

export const modelPricingSchema = z.object({
  baseCostCents: z.number().int().nonnegative(),
  perSecondCents: z.number().int().nonnegative(),
  perAssetCents: z.number().int().nonnegative(),
  currency: z.literal("CNY")
});

export const modelCapabilitySchema = z.object({
  id: z.string().min(1).max(120),
  provider: providerSchema,
  displayName: z.string().min(1).max(120),
  supportedModes: z.array(generationModeSchema).min(1),
  supportedReferenceModes: z.array(referenceModeSchema).min(1),
  supportedAspectRatios: z.array(aspectRatioSchema).min(1),
  supportedResolutions: z.array(videoResolutionSchema).min(1),
  supportedDurationsSeconds: z.array(videoDurationSecondsSchema).min(1),
  supportsAudioReference: z.boolean(),
  maxPromptLength: z.number().int().positive().max(MAX_PROMPT_LENGTH).default(MAX_PROMPT_LENGTH),
  maxAssetRefs: z.number().int().nonnegative().max(MAX_ASSET_REFS).default(MAX_ASSET_REFS),
  pricing: modelPricingSchema,
  enabled: z.boolean().default(true)
});

export const generationParametersSchema = z.object({
  modelId: z.string().min(1).max(120),
  mode: generationModeSchema,
  referenceMode: referenceModeSchema,
  aspectRatio: aspectRatioSchema,
  resolution: videoResolutionSchema,
  durationSeconds: videoDurationSecondsSchema
});

export const modelCompatibilityInputSchema = z.object({
  capability: modelCapabilitySchema,
  parameters: generationParametersSchema,
  assetRefs: z.array(assetMentionSchema).max(MAX_ASSET_REFS)
});

export function modelSupportsParameters(input: ModelCompatibilityInput): boolean {
  const hasAudioRef = input.assetRefs.some((asset) => asset.kind === "audio");

  return (
    input.capability.id === input.parameters.modelId &&
    input.capability.supportedModes.includes(input.parameters.mode) &&
    input.capability.supportedReferenceModes.includes(input.parameters.referenceMode) &&
    input.capability.supportedAspectRatios.includes(input.parameters.aspectRatio) &&
    input.capability.supportedResolutions.includes(input.parameters.resolution) &&
    input.capability.supportedDurationsSeconds.includes(input.parameters.durationSeconds) &&
    (!hasAudioRef || input.capability.supportsAudioReference) &&
    input.assetRefs.length <= input.capability.maxAssetRefs
  );
}

export type Provider = z.infer<typeof providerSchema>;
export type GenerationMode = z.infer<typeof generationModeSchema>;
export type ReferenceMode = z.infer<typeof referenceModeSchema>;
export type AspectRatio = z.infer<typeof aspectRatioSchema>;
export type VideoResolution = z.infer<typeof videoResolutionSchema>;
export type VideoDurationSeconds = z.infer<typeof videoDurationSecondsSchema>;
export type ModelPricing = z.infer<typeof modelPricingSchema>;
export type ModelCapability = z.infer<typeof modelCapabilitySchema>;
export type GenerationParameters = z.infer<typeof generationParametersSchema>;
export type ModelCompatibilityInput = z.infer<typeof modelCompatibilityInputSchema>;
