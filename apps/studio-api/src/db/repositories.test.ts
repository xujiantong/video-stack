import { describe, expect, it } from "vitest";
import { createInMemoryStudioRepository } from "./repositories";

const ids = [
  "00000000-0000-4000-8000-000000000501",
  "00000000-0000-4000-8000-000000000001",
  "00000000-0000-4000-8000-000000000101",
  "00000000-0000-4000-8000-000000000401",
  "00000000-0000-4000-8000-000000000201",
  "00000000-0000-4000-8000-000000000301",
  "00000000-0000-4000-8000-000000000302"
];

function createIdFactory() {
  const nextIds = [...ids];
  return () => {
    const id = nextIds.shift();
    if (!id) throw new Error("测试 ID 已用完");
    return id;
  };
}

describe("createInMemoryStudioRepository", () => {
  it("creates core records and keeps encrypted credentials out of public task data", async () => {
    const now = new Date("2026-04-28T07:34:29.545Z");
    const repo = createInMemoryStudioRepository({
      idFactory: createIdFactory(),
      now: () => now
    });

    const user = await repo.createUser({ email: "creator@example.com" });
    const project = await repo.createProject({ name: "影栈 Studio", userId: user.id });
    const asset = await repo.createAsset({
      projectId: project.id,
      userId: user.id,
      kind: "image",
      mimeType: "image/png",
      name: "包装主图",
      sizeBytes: 2048,
      tosBucket: "local",
      tosKey: "assets/main.png",
      status: "ready"
    });
    const credential = await repo.createProviderCredential({
      userId: user.id,
      provider: "jimeng",
      displayName: "即梦主账号",
      encryptedSecret: "ciphertext",
      iv: "iviviviviviv",
      authTag: "authtagauthtag12",
      maskedLabel: "sk-****-8F2A"
    });
    const task = await repo.createGenerationTask({
      projectId: project.id,
      userId: user.id,
      provider: "jimeng",
      promptDoc: { type: "doc", content: [] },
      promptText: "生成 8 秒产品展示视频",
      assetRefs: [{ id: asset.id, kind: "image", label: "包装主图" }],
      estimatedCostCents: 860,
      status: "queued"
    });

    expect(credential.encryptedSecret).toBe("ciphertext");
    expect(task.status).toBe("queued");
    expect(task.assetRefs).toEqual([{ id: asset.id, kind: "image", label: "包装主图" }]);
    expect(task.createdAt).toEqual(now);
  });

  it("soft deletes assets and writes terminal task states", async () => {
    const first = new Date("2026-04-28T07:34:29.545Z");
    const second = new Date("2026-04-28T07:35:29.545Z");
    let current = first;
    const repo = createInMemoryStudioRepository({
      idFactory: createIdFactory(),
      now: () => current
    });

    const user = await repo.createUser({ email: "creator@example.com" });
    const project = await repo.createProject({ name: "影栈 Studio", userId: user.id });
    const inputAsset = await repo.createAsset({
      projectId: project.id,
      userId: user.id,
      kind: "image",
      mimeType: "image/png",
      name: "包装主图",
      sizeBytes: 2048,
      tosKey: "assets/main.png",
      status: "ready"
    });
    await repo.createProviderCredential({
      userId: user.id,
      provider: "jimeng",
      displayName: "即梦主账号",
      encryptedSecret: "ciphertext",
      iv: "iviviviviviv",
      authTag: "authtagauthtag12",
      maskedLabel: "sk-****-8F2A"
    });
    const task = await repo.createGenerationTask({
      projectId: project.id,
      userId: user.id,
      provider: "jimeng",
      promptDoc: { type: "doc", content: [] },
      promptText: "生成 8 秒产品展示视频",
      assetRefs: [],
      estimatedCostCents: 860,
      status: "running"
    });
    current = second;

    const deletedAsset = await repo.softDeleteAsset(inputAsset.id);
    const failedTask = await repo.markGenerationTaskFailed(task.id, "PROVIDER_TIMEOUT", "Provider 请求超时，请稍后重试。");
    const resultAsset = await repo.createAsset({
      projectId: project.id,
      userId: user.id,
      kind: "video",
      mimeType: "video/mp4",
      name: "生成结果",
      sizeBytes: 4096,
      tosKey: "assets/result.mp4",
      status: "ready"
    });
    const succeededTask = await repo.markGenerationTaskSucceeded(task.id, resultAsset.id, 900);

    expect(deletedAsset.status).toBe("deleted");
    expect(deletedAsset.deletedAt).toEqual(second);
    expect(failedTask.status).toBe("failed");
    expect(failedTask.errorCode).toBe("PROVIDER_TIMEOUT");
    expect(succeededTask.status).toBe("succeeded");
    expect(succeededTask.resultAssetId).toBe(resultAsset.id);
    expect(succeededTask.actualCostCents).toBe(900);
  });

  it("lists generation tasks from oldest to newest", async () => {
    const first = new Date("2026-04-28T07:34:29.545Z");
    const second = new Date("2026-04-28T07:35:29.545Z");
    let current = first;
    const repo = createInMemoryStudioRepository({
      idFactory: createIdFactory(),
      now: () => current
    });

    const user = await repo.createUser({ email: "creator@example.com" });
    const project = await repo.createProject({ name: "影栈 Studio", userId: user.id });
    const oldTask = await repo.createGenerationTask({
      projectId: project.id,
      userId: user.id,
      provider: "jimeng",
      promptDoc: { type: "doc", content: [] },
      promptText: "旧任务",
      assetRefs: [],
      estimatedCostCents: 0,
      status: "succeeded"
    });
    current = second;
    const newTask = await repo.createGenerationTask({
      projectId: project.id,
      userId: user.id,
      provider: "jimeng",
      promptDoc: { type: "doc", content: [] },
      promptText: "新任务",
      assetRefs: [],
      estimatedCostCents: 0,
      status: "queued"
    });

    await expect(repo.listGenerationTasks(project.id)).resolves.toEqual([oldTask, newTask]);
  });
});
