import type { Credential, CreateCredentialRequest, TestCredentialResponse } from "@video-stack/shared";
import type { ProviderCredentialRecord, StudioRepository } from "../db/repositories";
import { decryptSecret, encryptSecret } from "../security/crypto";

type SecretPayload = {
  apiKey?: string;
  secretKey: string;
};

export type CredentialService = {
  saveCredential(input: CreateCredentialRequest): Promise<Credential>;
  listCredentials(): Promise<Credential[]>;
  deleteCredential(credentialId: string): Promise<void>;
  testCredential(credentialId: string): Promise<TestCredentialResponse>;
};

type CredentialServiceOptions = {
  repository: StudioRepository;
  userId: string;
  secretKey: Buffer;
  now?: () => Date;
};

export function maskSecret(secret: string): string {
  const visibleTail = secret.trim().slice(-4).toUpperCase();
  return `sk-****-${visibleTail}`;
}

export function createCredentialService({ repository, userId, secretKey, now = () => new Date() }: CredentialServiceOptions): CredentialService {
  return {
    async saveCredential(input) {
      const secretPayload: SecretPayload = input.apiKey ? { apiKey: input.apiKey, secretKey: input.secretKey } : { secretKey: input.secretKey };
      const encrypted = encryptSecret(JSON.stringify(secretPayload), secretKey);
      const row = await repository.createProviderCredential({
        userId,
        provider: input.provider,
        displayName: input.displayName,
        encryptedSecret: encrypted.encryptedSecret,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        maskedLabel: maskSecret(input.secretKey)
      });

      return toPublicCredential(row);
    },
    async listCredentials() {
      const rows = await repository.listProviderCredentials(userId);
      return rows.map(toPublicCredential);
    },
    async deleteCredential(credentialId) {
      await repository.revokeProviderCredential(credentialId);
    },
    async testCredential(credentialId) {
      const row = await repository.getProviderCredential(credentialId);
      const payload = JSON.parse(
        decryptSecret(
          {
            encryptedSecret: row.encryptedSecret,
            iv: row.iv,
            authTag: row.authTag
          },
          secretKey
        )
      ) as SecretPayload;
      const ok = payload.secretKey.trim().length >= 8;

      return {
        credentialId,
        ok,
        checkedAt: now().toISOString(),
        message: ok ? "凭证已保存并可解密。真实连通性将在接入即梦 Provider 后检测。" : "Secret Key 无效，请重新输入后保存。"
      };
    }
  };
}

function toPublicCredential(row: ProviderCredentialRecord): Credential {
  return {
    id: row.id,
    provider: row.provider,
    displayName: row.displayName,
    maskedLabel: row.maskedLabel,
    serviceRegion: null,
    defaultModelId: null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}
