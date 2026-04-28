import cors from "@fastify/cors";
import Fastify from "fastify";
import { readEnv, readSecretKey } from "./config/env";
import { createInMemoryStudioRepository } from "./db/repositories";
import { createCredentialRoutes } from "./routes/credentials";
import { generationRoutes } from "./routes/generation";
import { createCredentialService } from "./services/credential-service";

export const defaultUserId = "00000000-0000-4000-8000-000000000501";

export async function buildServer() {
  const env = readEnv();
  const repository = createInMemoryStudioRepository();
  await repository.createUser({ email: "local@studio.internal", id: defaultUserId });
  const credentialService = createCredentialService({
    repository,
    secretKey: readSecretKey(env),
    userId: defaultUserId
  });

  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });
  await app.register(createCredentialRoutes(credentialService), { prefix: "/api" });
  await app.register(generationRoutes, { prefix: "/api" });

  app.get("/health", async () => ({ ok: true }));
  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const env = readEnv();
  const app = await buildServer();
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
}
