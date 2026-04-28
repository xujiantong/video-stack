import { z } from "zod";
import { ERROR_CODES, RETRYABLE_ERROR_CODES } from "../constants";

export const errorCodeSchema = z.enum(ERROR_CODES);

export const apiErrorSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string().min(1).max(500),
    requestId: z.string().min(6).max(120).optional(),
    details: z.record(z.unknown()).optional()
  })
});

export const providerErrorSchema = z.object({
  code: errorCodeSchema,
  message: z.string().min(1).max(500),
  retryable: z.boolean(),
  providerRequestId: z.string().min(1).max(160).optional()
});

export function isRetryableErrorCode(code: ErrorCode): boolean {
  return (RETRYABLE_ERROR_CODES as readonly ErrorCode[]).includes(code);
}

export type ErrorCode = z.infer<typeof errorCodeSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
export type ProviderError = z.infer<typeof providerErrorSchema>;
