import { describe, expect, it } from "vitest";
import { createCredentialRequestSchema, credentialSchema, encryptedCredentialSchema } from "./credentials";

const now = "2026-04-28T07:24:30.146Z";

describe("credential schemas", () => {
  it("accepts a credential create request with optional API metadata", () => {
    const result = createCredentialRequestSchema.safeParse({
      provider: "jimeng",
      displayName: "即梦主账号",
      apiKey: "ak_demo",
      secretKey: "secret_demo_123456",
      serviceRegion: "cn-north",
      defaultModelId: "seedance-demo"
    });

    expect(result.success).toBe(true);
  });

  it("rejects short secret keys", () => {
    const result = createCredentialRequestSchema.safeParse({
      provider: "jimeng",
      displayName: "即梦主账号",
      secretKey: "short"
    });

    expect(result.success).toBe(false);
  });

  it("separates public masked credentials from encrypted storage records", () => {
    const publicResult = credentialSchema.safeParse({
      id: "00000000-0000-4000-8000-000000000401",
      provider: "jimeng",
      displayName: "即梦主账号",
      maskedLabel: "sk-****-8F2A",
      serviceRegion: null,
      defaultModelId: null,
      createdAt: now,
      updatedAt: now
    });

    const encryptedResult = encryptedCredentialSchema.safeParse({
      id: "00000000-0000-4000-8000-000000000401",
      userId: "00000000-0000-4000-8000-000000000501",
      provider: "jimeng",
      encryptedSecret: "ciphertext",
      iv: "123456789012",
      authTag: "1234567890123456",
      maskedLabel: "sk-****-8F2A",
      createdAt: now,
      updatedAt: now
    });

    expect(publicResult.success).toBe(true);
    expect(encryptedResult.success).toBe(true);
    if (!publicResult.success) throw new Error("public credential parse failed");
    expect("secretKey" in publicResult.data).toBe(false);
  });
});
