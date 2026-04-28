import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { createInMemoryStudioRepository } from "../db/repositories";
import { createCredentialRoutes } from "./credentials";
import { createCredentialService } from "../services/credential-service";

const userId = "00000000-0000-4000-8000-000000000501";
const credentialId = "00000000-0000-4000-8000-000000000401";
const now = new Date("2026-04-28T07:45:31.309Z");

async function buildCredentialTestServer() {
  const app = Fastify();
  const repository = createInMemoryStudioRepository({
    idFactory: () => credentialId,
    now: () => now
  });
  await repository.createUser({ email: "local@studio.internal", id: userId });
  const service = createCredentialService({
    repository,
    secretKey: Buffer.alloc(32, 1),
    userId,
    now: () => now
  });
  await app.register(createCredentialRoutes(service), { prefix: "/api" });
  return app;
}

describe("credential routes", () => {
  it("saves, lists, tests, and deletes credentials without returning secrets", async () => {
    const app = await buildCredentialTestServer();

    const saveResponse = await app.inject({
      method: "POST",
      url: "/api/provider-credentials",
      payload: {
        provider: "jimeng",
        displayName: "即梦主账号",
        apiKey: "ak_demo",
        secretKey: "sk_secret_8f2a"
      }
    });
    const savedBody = saveResponse.json<unknown>();

    expect(saveResponse.statusCode).toBe(201);
    expect(JSON.stringify(savedBody)).toContain("sk-****-8F2A");
    expect(JSON.stringify(savedBody)).not.toContain("sk_secret_8f2a");
    expect(JSON.stringify(savedBody)).not.toContain("ak_demo");

    const listResponse = await app.inject({ method: "GET", url: "/api/provider-credentials" });
    expect(listResponse.statusCode).toBe(200);
    expect(JSON.stringify(listResponse.json<unknown>())).not.toContain("sk_secret_8f2a");

    const testResponse = await app.inject({ method: "POST", url: `/api/provider-credentials/${credentialId}/test` });
    expect(testResponse.statusCode).toBe(200);
    expect(testResponse.json<{ ok: boolean }>().ok).toBe(true);

    const deleteResponse = await app.inject({ method: "DELETE", url: `/api/provider-credentials/${credentialId}` });
    expect(deleteResponse.statusCode).toBe(204);

    const emptyListResponse = await app.inject({ method: "GET", url: "/api/provider-credentials" });
    expect(emptyListResponse.json<unknown[]>()).toEqual([]);
  });
});
