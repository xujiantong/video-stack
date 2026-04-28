import type { FastifyPluginAsync } from "fastify";
import { DEFAULT_MODEL_CAPABILITIES, modelCapabilitySchema } from "@video-stack/shared";

export const modelRoutes: FastifyPluginAsync = async (app) => {
  app.get("/models", async () => modelCapabilitySchema.array().parse(DEFAULT_MODEL_CAPABILITIES.filter((model) => model.enabled)));
};
