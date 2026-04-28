import {
  apiErrorSchema,
  credentialSchema,
  createCredentialRequestSchema,
  testCredentialResponseSchema,
  type Credential,
  type CreateCredentialRequest,
  type TestCredentialResponse
} from "@video-stack/shared";

const credentialsEndpoint = "/api/provider-credentials";

export async function listCredentials(): Promise<Credential[]> {
  const response = await fetch(credentialsEndpoint);
  await assertOk(response, "读取凭证失败，请稍后重试。");
  return credentialSchema.array().parse(await response.json());
}

export async function saveCredential(input: CreateCredentialRequest): Promise<Credential> {
  const payload = createCredentialRequestSchema.parse(input);
  const response = await fetch(credentialsEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  await assertOk(response, "保存凭证失败，请检查字段后重试。");
  return credentialSchema.parse(await response.json());
}

export async function testCredential(credentialId: string): Promise<TestCredentialResponse> {
  const response = await fetch(`${credentialsEndpoint}/${credentialId}/test`, { method: "POST" });
  await assertOk(response, "检测凭证失败，请重新保存后再试。");
  return testCredentialResponseSchema.parse(await response.json());
}

export async function deleteCredential(credentialId: string): Promise<void> {
  const response = await fetch(`${credentialsEndpoint}/${credentialId}`, { method: "DELETE" });
  await assertOk(response, "删除凭证失败，请刷新后重试。");
}

async function assertOk(response: Response, fallbackMessage: string): Promise<void> {
  if (response.ok) return;
  const body = await readJson(response);
  const parsed = apiErrorSchema.safeParse(body);
  if (parsed.success) {
    throw new Error(parsed.data.error.message);
  }
  throw new Error(fallbackMessage);
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
