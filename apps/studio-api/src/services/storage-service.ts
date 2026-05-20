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
  writeObject?(storageKey: string, bytes: Buffer, mimeType: string): Promise<void>;
  readObject?(storageKey: string): Promise<Buffer>;
  readObjectRange?(storageKey: string, start: number, end: number): Promise<Buffer>;
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
    },
    async writeObject(storageKey, bytes) {
      objects.set(storageKey, bytes);
    },
    async readObject(storageKey) {
      const bytes = objects.get(storageKey);
      if (!bytes) throw new Error(`对象不存在：${storageKey}`);
      return bytes;
    },
    async readObjectRange(storageKey, start, end) {
      const bytes = objects.get(storageKey);
      if (!bytes) throw new Error(`对象不存在：${storageKey}`);
      return bytes.subarray(start, end + 1);
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
  const createClient = async () => {
    const { S3Client } = await import("@aws-sdk/client-s3");
    return new S3Client({
      region: STUDIO_S3_REGION,
      endpoint: STUDIO_S3_ENDPOINT,
      forcePathStyle: true,
      credentials: {
        accessKeyId: STUDIO_S3_ACCESS_KEY_ID,
        secretAccessKey: STUDIO_S3_SECRET_ACCESS_KEY
      }
    });
  };

  return {
    bucket,
    async createUpload(storageKey, mimeType, sizeBytes) {
      const { PutObjectCommand } = await import("@aws-sdk/client-s3");
      const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
      const client = await createClient();

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
    },
    async writeObject(storageKey, bytes, mimeType) {
      const { PutObjectCommand } = await import("@aws-sdk/client-s3");
      const client = await createClient();
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: storageKey,
          Body: bytes,
          ContentType: mimeType,
          ContentLength: bytes.byteLength
        })
      );
    },
    async readObject(storageKey) {
      const { GetObjectCommand } = await import("@aws-sdk/client-s3");
      const client = await createClient();
      const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: storageKey }));
      if (!result.Body) throw new Error(`对象不存在：${storageKey}`);
      return collectBody(result.Body as AsyncIterable<Uint8Array>);
    },
    async readObjectRange(storageKey, start, end) {
      const { GetObjectCommand } = await import("@aws-sdk/client-s3");
      const client = await createClient();
      const result = await client.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: storageKey,
          Range: `bytes=${start}-${end}`
        })
      );
      if (!result.Body) throw new Error(`对象不存在：${storageKey}`);
      return collectBody(result.Body as AsyncIterable<Uint8Array>);
    }
  };
}

async function collectBody(body: AsyncIterable<Uint8Array>): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of body) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
