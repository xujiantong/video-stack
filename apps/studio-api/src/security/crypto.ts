import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type EncryptedSecret = {
  encryptedSecret: string;
  iv: string;
  authTag: string;
};

export function encryptSecret(secret: string, key: Buffer): EncryptedSecret {
  assertKey(key);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return {
    encryptedSecret: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64")
  };
}

export function decryptSecret(payload: EncryptedSecret, key: Buffer): string {
  assertKey(key);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(payload.encryptedSecret, "base64")),
    decipher.final()
  ]).toString("utf8");
}

function assertKey(key: Buffer): void {
  if (key.length !== 32) {
    throw new Error("加密密钥必须是 32 字节");
  }
}
