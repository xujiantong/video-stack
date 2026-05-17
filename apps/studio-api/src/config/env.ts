import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url().default("postgres://studio:studio@localhost:5432/studio"),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  STUDIO_SECRET_KEY_BASE64: z.string().default(Buffer.alloc(32).toString("base64")),
  STUDIO_STORAGE_MODE: z.enum(["local", "s3"]).default("local"),
  STUDIO_STORAGE_BUCKET: z.string().min(1).default("studio-assets"),
  STUDIO_S3_ENDPOINT: z.string().url().optional(),
  STUDIO_S3_REGION: z.string().min(1).default("auto"),
  STUDIO_S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  STUDIO_S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  STUDIO_GENERATION_MODE: z.enum(["inline", "worker"]).default("inline"),
  JIMENG_ACCESS_KEY_ID: z.string().min(1).optional(),
  JIMENG_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  JIMENG_REQ_KEY: z.string().min(1).default("jimeng_t2v_v30"),
  PORT: z.coerce.number().int().positive().default(4000)
});

export type StudioEnv = z.infer<typeof envSchema>;

export function readEnv(source: NodeJS.ProcessEnv = process.env): StudioEnv {
  return envSchema.parse(source);
}

export function readSecretKey(env: Pick<StudioEnv, "STUDIO_SECRET_KEY_BASE64">): Buffer {
  const key = Buffer.from(env.STUDIO_SECRET_KEY_BASE64, "base64");
  if (key.length !== 32) {
    throw new Error("STUDIO_SECRET_KEY_BASE64 必须是 32 字节 Base64 密钥");
  }
  return key;
}
