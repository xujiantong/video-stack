import { readEnv, type StudioEnv } from "../config/env";

export type PresignedUpload = {
  url: string;
  headers: Record<string, string>;
  expiresAt: string;
};

export type StorageService = {
  bucket: string;
  createUpload(storageKey: string, mimeType: string, sizeBytes: number): Promise<PresignedUpload>;
  acceptLocalUpload?(storageKey: string, bytes: Buffer): Promise<void>;
};

export function createStorageService(env: StudioEnv = readEnv()): StorageService {
  if (env.STUDIO_STORAGE_MODE === "s3") {
    return createS3StorageService(env);
  }
  return createLocalStorageService(env);
}

function createLocalStorageService(env: StudioEnv): StorageService {
  const bucket = env.STUDIO_STORAGE_BUCKET;
  const objects = new Map<string, Buffer>();

  return {
    bucket,
    async createUpload(storageKey, mimeType) {
      const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
      return {
        url: `/api/assets/uploads/${encodeURIComponent(storageKey)}`,
        headers: { "Content-Type": mimeType },
        expiresAt
      };
    },
    async acceptLocalUpload(storageKey, bytes) {
      objects.set(storageKey, bytes);
    }
  };
}

type RequiredS3Env = {
  STUDIO_S3_ENDPOINT: string;
  STUDIO_S3_REGION: string;
  STUDIO_S3_ACCESS_KEY_ID: string;
  STUDIO_S3_SECRET_ACCESS_KEY: string;
};

function requireS3Env(env: StudioEnv): RequiredS3Env {
  if (!env.STUDIO_S3_ENDPOINT) throw new Error("缺少 STUDIO_S3_ENDPOINT，请配置对象存储 Endpoint。");
  if (!env.STUDIO_S3_REGION) throw new Error("缺少 STUDIO_S3_REGION，请配置对象存储 Region。");
  if (!env.STUDIO_S3_ACCESS_KEY_ID) throw new Error("缺少 STUDIO_S3_ACCESS_KEY_ID，请配置对象存储 Access Key。");
  if (!env.STUDIO_S3_SECRET_ACCESS_KEY) throw new Error("缺少 STUDIO_S3_SECRET_ACCESS_KEY，请配置对象存储 Secret Key。");
  return {
    STUDIO_S3_ENDPOINT: env.STUDIO_S3_ENDPOINT,
    STUDIO_S3_REGION: env.STUDIO_S3_REGION,
    STUDIO_S3_ACCESS_KEY_ID: env.STUDIO_S3_ACCESS_KEY_ID,
    STUDIO_S3_SECRET_ACCESS_KEY: env.STUDIO_S3_SECRET_ACCESS_KEY
  };
}

function createS3StorageService(env: StudioEnv): StorageService {
  const bucket = env.STUDIO_STORAGE_BUCKET;
  const { STUDIO_S3_ENDPOINT, STUDIO_S3_REGION, STUDIO_S3_ACCESS_KEY_ID, STUDIO_S3_SECRET_ACCESS_KEY } = requireS3Env(env);

  return {
    bucket,
    async createUpload(storageKey, mimeType, sizeBytes) {
      const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
      const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

      const client = new S3Client({
        region: STUDIO_S3_REGION,
        endpoint: STUDIO_S3_ENDPOINT,
        forcePathStyle: true,
        credentials: {
          accessKeyId: STUDIO_S3_ACCESS_KEY_ID,
          secretAccessKey: STUDIO_S3_SECRET_ACCESS_KEY
        }
      });

      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: storageKey,
        ContentType: mimeType,
        ContentLength: sizeBytes
      });

      const expiresIn = 15 * 60;
      const url = await getSignedUrl(client, command, { expiresIn });
      return {
        url,
        headers: { "Content-Type": mimeType },
        expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString()
      };
    }
  };
}
