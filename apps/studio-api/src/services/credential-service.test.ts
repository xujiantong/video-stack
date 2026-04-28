import { describe, expect, it } from "vitest";
import { createInMemoryStudioRepository } from "../db/repositories";
import { createCredentialService, maskSecret } from "./credential-service";

const userId = "00000000-0000-4000-8000-000000000501";
const credentialId = "00000000-0000-4000-8000-000000000401";
const now = new Date("2026-04-28T07:45:31.309Z");

describe("CredentialService", () => {
  it("encrypts secrets and returns only masked credential data", async () => {
    const repository = createInMemoryStudioRepository({
      idFactory: () => credentialId,
      now: () => now
    });
    await repository.createUser({ email: "local@studio.internal", id: userId });
    const service = createCredentialService({
      repository,
      secretKey: Buffer.alloc(32, 1),
      userId,
      now: () => now
    });

    const credential = await service.saveCredential({
      provider: "jimeng",
      displayName: "即梦主账号",
      apiKey: "ak_demo",
      secretKey: "sk_secret_8f2a"
    });

    expect(credential.maskedLabel).toBe("sk-****-8F2A");
    expect(JSON.stringify(credential)).not.toContain("sk_secret_8f2a");
    expect(JSON.stringify(credential)).not.toContain("ak_demo");

    const saved = await repository.getProviderCredential(credential.id);
    expect(saved.encryptedSecret).not.toContain("sk_secret_8f2a");
    expect(saved.encryptedSecret).not.toContain("ak_demo");
  });

  it("tests and deletes saved credentials without exposing Secret Key", async () => {
    const repository = createInMemoryStudioRepository({
      idFactory: () => credentialId,
      now: () => now
    });
    await repository.createUser({ email: "local@studio.internal", id: userId });
    const service = createCredentialService({
      repository,
      secretKey: Buffer.alloc(32, 1),
      userId,
      now: () => now
    });
    const credential = await service.saveCredential({
      provider: "jimeng",
      displayName: "即梦主账号",
      secretKey: "sk_secret_8f2a"
    });

    const testResult = await service.testCredential(credential.id);
    await service.deleteCredential(credential.id);

    expect(testResult.ok).toBe(true);
    expect(testResult.message).toBe("凭证已保存并可解密。真实连通性将在接入即梦 Provider 后检测。");
    await expect(service.listCredentials()).resolves.toEqual([]);
  });

  it("masks the secret tail only", () => {
    expect(maskSecret("sk_secret_8f2a")).toBe("sk-****-8F2A");
  });
});
