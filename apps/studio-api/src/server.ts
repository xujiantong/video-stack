import cors from "@fastify/cors";
import Fastify from "fastify";
import { readEnv } from "./config/env";
import { generationRoutes } from "./routes/generation";

export async function buildServer() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });
  await app.register(generationRoutes, { prefix: "/api" });

  app.get("/health", async () => ({ ok: true }));
  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const env = readEnv();
  const app = await buildServer();
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
}
