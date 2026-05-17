import cors from "@fastify/cors";
import Fastify from "fastify";
import { readEnv, readSecretKey } from "./config/env";
import { createPostgresStudioRepository } from "./db/postgres-repository";
import { createBullMqGenerationQueue, createInlineGenerationQueue } from "./queue/generation-queue";
import { createAssetRoutes } from "./routes/assets";
import { createCredentialRoutes } from "./routes/credentials";
import { createGenerationRoutes } from "./routes/generation";
import { modelRoutes } from "./routes/models";
import { encryptSecret } from "./security/crypto";
import { createAssetService } from "./services/asset-service";
import { createCredentialService } from "./services/credential-service";
import { createGenerationRunner } from "./services/generation-runner";
import { createStorageService } from "./services/storage-service";

export const defaultUserId = "00000000-0000-4000-8000-000000000501";
export const defaultProjectId = "00000000-0000-4000-8000-000000000001";
export const defaultCredentialId = "00000000-0000-4000-8000-000000000401";

export async function buildServer() {
  const env = readEnv();
  const secretKey = readSecretKey(env);
  const repository = createPostgresStudioRepository(env.DATABASE_URL);
  await repository.createUser({ email: "local@studio.internal", id: defaultUserId });
  await repository.createProject({ id: defaultProjectId, userId: defaultUserId, name: "影栈 Studio" });
  const defaultCredential = createDefaultCredential(env, secretKey);
  await repository.createProviderCredential({
    id: defaultCredentialId,
    userId: defaultUserId,
    provider: "jimeng",
    displayName: "即梦本地凭证",
    encryptedSecret: defaultCredential.encryptedSecret,
    iv: defaultCredential.iv,
    authTag: defaultCredential.authTag,
    maskedLabel: defaultCredential.maskedLabel
  });
  const credentialService = createCredentialService({
    repository,
    secretKey,
    userId: defaultUserId
  });
  const storage = createStorageService(env);
  const assetService = createAssetService({ repository, storage, userId: defaultUserId });
  const generationQueue =
    env.STUDIO_GENERATION_MODE === "worker"
      ? createBullMqGenerationQueue(env.REDIS_URL)
      : createInlineGenerationQueue(createGenerationRunner({ repository, secretKey, storage }));

  const app = Fastify({ logger: true });
  app.addHook("onClose", async () => {
    await generationQueue.close?.();
    await repository.close?.();
  });
  await app.register(cors, { origin: true });
  await app.register(createCredentialRoutes(credentialService), { prefix: "/api" });
  await app.register(createAssetRoutes(assetService), { prefix: "/api" });
  await app.register(modelRoutes, { prefix: "/api" });
  await app.register(createGenerationRoutes({ repository, queue: generationQueue, userId: defaultUserId }), { prefix: "/api" });

  app.get("/health", async () => ({ ok: true }));
  return app;
}

function createDefaultCredential(env: ReturnType<typeof readEnv>, secretKey: Buffer) {
  const payload = {
    apiKey: env.JIMENG_ACCESS_KEY_ID ?? "",
    secretKey: env.JIMENG_SECRET_ACCESS_KEY ?? ""
  };
  const encrypted = encryptSecret(JSON.stringify(payload), secretKey);
  return {
    ...encrypted,
    maskedLabel: maskSecret(payload.secretKey)
  };
}

function maskSecret(secret: string): string {
  const visibleTail = secret.trim().slice(-4).toUpperCase();
  return visibleTail ? `sk-****-${visibleTail}` : "sk-****-未配置";
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const env = readEnv();
  const app = await buildServer();
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
}
