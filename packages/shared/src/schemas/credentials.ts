import { z } from "zod";
import { providerSchema } from "./models";

export const maskedSecretSchema = z.string().min(6).max(80);

export const createCredentialRequestSchema = z.object({
  provider: providerSchema,
  displayName: z.string().min(1).max(80),
  apiKey: z.string().min(1).max(512).optional(),
  secretKey: z.string().min(8).max(4000),
  serviceRegion: z.string().min(1).max(80).optional(),
  defaultModelId: z.string().min(1).max(120).optional()
});

export const credentialSchema = z.object({
  id: z.string().uuid(),
  provider: providerSchema,
  displayName: z.string().min(1).max(80),
  maskedLabel: maskedSecretSchema,
  serviceRegion: z.string().min(1).max(80).nullable(),
  defaultModelId: z.string().min(1).max(120).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const encryptedCredentialSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  provider: providerSchema,
  encryptedSecret: z.string().min(1),
  iv: z.string().min(12),
  authTag: z.string().min(16),
  maskedLabel: maskedSecretSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable().optional()
});

export const testCredentialResponseSchema = z.object({
  credentialId: z.string().uuid(),
  ok: z.boolean(),
  checkedAt: z.string().datetime(),
  message: z.string().min(1).max(200)
});

export type CreateCredentialRequest = z.infer<typeof createCredentialRequestSchema>;
export type Credential = z.infer<typeof credentialSchema>;
export type EncryptedCredential = z.infer<typeof encryptedCredentialSchema>;
export type TestCredentialResponse = z.infer<typeof testCredentialResponseSchema>;
