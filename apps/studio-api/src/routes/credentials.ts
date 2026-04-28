import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { createCredentialRequestSchema } from "@video-stack/shared";
import type { CredentialService } from "../services/credential-service";

const credentialParamsSchema = z.object({
  credentialId: z.string().uuid()
});

export function createCredentialRoutes(service: CredentialService): FastifyPluginAsync {
  return async (app) => {
    app.get("/provider-credentials", async () => service.listCredentials());

    app.post("/provider-credentials", async (request, reply) => {
      const input = createCredentialRequestSchema.parse(request.body);
      const credential = await service.saveCredential(input);
      return reply.code(201).send(credential);
    });

    app.delete("/provider-credentials/:credentialId", async (request, reply) => {
      const { credentialId } = credentialParamsSchema.parse(request.params);
      await service.deleteCredential(credentialId);
      return reply.code(204).send();
    });

    app.post("/provider-credentials/:credentialId/test", async (request) => {
      const { credentialId } = credentialParamsSchema.parse(request.params);
      return service.testCredential(credentialId);
    });
  };
}
