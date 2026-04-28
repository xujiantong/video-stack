import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url().default("postgres://studio:studio@localhost:5432/studio"),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  STUDIO_SECRET_KEY_BASE64: z.string().default(Buffer.alloc(32).toString("base64")),
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
