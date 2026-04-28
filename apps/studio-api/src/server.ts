import cors from "@fastify/cors";
import Fastify from "fastify";
import { readEnv, readSecretKey } from "./config/env";
import { createInMemoryStudioRepository } from "./db/repositories";
import { createBullMqGenerationQueue } from "./queue/generation-queue";
import { createAssetRoutes } from "./routes/assets";
import { createCredentialRoutes } from "./routes/credentials";
import { createGenerationRoutes } from "./routes/generation";
import { modelRoutes } from "./routes/models";
import { createAssetService } from "./services/asset-service";
import { createCredentialService } from "./services/credential-service";
import { createStorageService } from "./services/storage-service";

export const defaultUserId = "00000000-0000-4000-8000-000000000501";
export const defaultProjectId = "00000000-0000-4000-8000-000000000001";
export const defaultCredentialId = "00000000-0000-4000-8000-000000000401";

export async function buildServer() {
  const env = readEnv();
  const repository = createInMemoryStudioRepository();
  await repository.createUser({ email: "local@studio.internal", id: defaultUserId });
  await repository.createProject({ id: defaultProjectId, userId: defaultUserId, name: "影栈 Studio" });
  await repository.createProviderCredential({
    id: defaultCredentialId,
    userId: defaultUserId,
    provider: "jimeng",
    displayName: "即梦本地凭证",
    encryptedSecret: "local",
    iv: "local-iv",
    authTag: "local-auth-tag",
    maskedLabel: "sk-****-local"
  });
  const credentialService = createCredentialService({
    repository,
    secretKey: readSecretKey(env),
    userId: defaultUserId
  });
  const storage = createStorageService(env);
  const assetService = createAssetService({ repository, storage, userId: defaultUserId });
  const generationQueue = createBullMqGenerationQueue(env.REDIS_URL);

  const app = Fastify({ logger: true });
  app.addHook("onClose", async () => generationQueue.close?.());
  await app.register(cors, { origin: true });
  await app.register(createCredentialRoutes(credentialService), { prefix: "/api" });
  await app.register(createAssetRoutes(assetService), { prefix: "/api" });
  await app.register(modelRoutes, { prefix: "/api" });
  await app.register(createGenerationRoutes({ repository, queue: generationQueue, userId: defaultUserId }), { prefix: "/api" });

  app.get("/health", async () => ({ ok: true }));
  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const env = readEnv();
  const app = await buildServer();
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
}
