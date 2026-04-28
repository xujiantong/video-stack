import { z } from "zod";

export const createCredentialRequestSchema = z.object({
  provider: z.literal("jimeng"),
  displayName: z.string().min(1).max(80),
  secretKey: z.string().min(8).max(4000)
});

export const credentialSchema = z.object({
  id: z.string().uuid(),
  provider: z.literal("jimeng"),
  displayName: z.string().min(1).max(80),
  createdAt: z.string().datetime()
});

export type CreateCredentialRequest = z.infer<typeof createCredentialRequestSchema>;
export type Credential = z.infer<typeof credentialSchema>;
