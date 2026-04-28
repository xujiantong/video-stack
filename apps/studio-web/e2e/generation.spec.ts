import { expect, test, type Page } from "@playwright/test";

const projectId = "00000000-0000-4000-8000-000000000001";
const defaultParameters = {
  modelId: "seedance-lite",
  mode: "text_to_video",
  referenceMode: "none",
  aspectRatio: "16:9",
  resolution: "720p",
  durationSeconds: 5
};

type E2eTask = {
  id: string;
  projectId: string;
  provider: "jimeng";
  promptText: string;
  promptDoc?: Record<string, unknown>;
  parameters: typeof defaultParameters;
  assetRefs: Array<{ id: string; kind: "image" | "video" | "audio"; label: string }>;
  status: "queued" | "running" | "succeeded" | "failed" | "canceled";
  estimatedCostCents: number;
  actualCostCents: number | null;
  requiresSecondConfirm: boolean;
  resultAssetId: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

function makeTask(input: Partial<E2eTask> & Pick<E2eTask, "id" | "promptText" | "status">): E2eTask {
  const now = "2026-04-28T08:00:00.000Z";
  return {
    projectId,
    provider: "jimeng",
    promptDoc: { type: "doc", content: [] },
    parameters: defaultParameters,
    assetRefs: [],
    estimatedCostCents: 860,
    actualCostCents: input.status === "succeeded" ? 860 : null,
    requiresSecondConfirm: false,
    resultAssetId: input.status === "succeeded" ? "00000000-0000-4000-8000-000000000301" : null,
    errorMessage: null,
    createdAt: now,
    updatedAt: now,
    ...input
  };
}

async function mockGenerationRoutes(page: Page, seedTasks: E2eTask[] = []) {
  const tasks = [...seedTasks];
  let createdTaskBody: Record<string, unknown> | undefined;
  let regenerateBody: Record<string, unknown> | undefined;
  let detailReads = 0;

  await page.route("**/api/generation/estimate", async (route) => {
    const body = route.request().postDataJSON() as { sourceTaskId?: string; promptText: string };
    const estimatedCostCents = body.sourceTaskId || body.promptText.length > 500 ? 2680 : 860;
    await route.fulfill({
      contentType: "application/json",
      json: {
        estimatedCostCents,
        estimatedSeconds: 54,
        requiresSecondConfirm: estimatedCostCents >= 2_000 || Boolean(body.sourceTaskId),
        secondConfirmToken: estimatedCostCents >= 2_000 || body.sourceTaskId ? "confirm-token-1234567890" : undefined
      }
    });
  });

  await page.route("**/api/generation/tasks**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "GET" && url.pathname === "/api/generation/tasks") {
      await route.fulfill({ contentType: "application/json", json: tasks });
      return;
    }
    if (request.method() === "POST" && url.pathname === "/api/generation/tasks") {
      createdTaskBody = request.postDataJSON() as Record<string, unknown>;
      const task = makeTask({
        id: "00000000-0000-4000-8000-000000000601",
        promptText: String(createdTaskBody.promptText),
        promptDoc: createdTaskBody.promptDoc as Record<string, unknown>,
        parameters: createdTaskBody.parameters as typeof defaultParameters,
        assetRefs: createdTaskBody.assetRefs as E2eTask["assetRefs"],
        status: "queued",
        estimatedCostCents: 2680,
        requiresSecondConfirm: true
      });
      tasks.unshift(task);
      await route.fulfill({ contentType: "application/json", json: task, status: 201 });
      return;
    }
    if (request.method() === "GET" && url.pathname.includes("/api/generation/tasks/")) {
      const taskId = url.pathname.split("/").at(-1);
      detailReads += 1;
      const task = tasks.find((row) => row.id === taskId);
      if (task && task.status === "running" && detailReads > 1) {
        task.status = "succeeded";
        task.actualCostCents = task.estimatedCostCents;
        task.resultAssetId = "00000000-0000-4000-8000-000000000302";
      }
      await route.fulfill({ contentType: "application/json", json: task });
      return;
    }
    if (request.method() === "POST" && url.pathname.endsWith("/regenerate")) {
      regenerateBody = request.postDataJSON() as Record<string, unknown>;
      const task = makeTask({
        id: "00000000-0000-4000-8000-000000000602",
        promptText: String(regenerateBody.promptText),
        parameters: regenerateBody.parameters as typeof defaultParameters,
        assetRefs: regenerateBody.assetRefs as E2eTask["assetRefs"],
        status: "queued",
        estimatedCostCents: 2680,
        requiresSecondConfirm: true
      });
      tasks.unshift(task);
      await route.fulfill({ contentType: "application/json", json: task, status: 201 });
      return;
    }
    await route.fallback();
  });

  return {
    getCreatedTaskBody: () => createdTaskBody,
    getRegenerateBody: () => regenerateBody
  };
}

test("user can estimate and create a generation task", async ({ page }) => {
  await mockGenerationRoutes(page);
  await page.goto("/");
  await page.getByRole("textbox", { name: "Prompt" }).fill("生成 8 秒产品展示视频");
  await page.getByRole("button", { name: "预估费用" }).click();
  await expect(page.getByText("预计费用")).toBeVisible();
  await page.getByRole("main").getByRole("button", { name: "生成", exact: true }).click();
  await expect(page.getByText("排队中").first()).toBeVisible();
});

test("user can upload an asset, mention it, tune parameters, confirm cost, and create a task", async ({ page }) => {
  const generation = await mockGenerationRoutes(page);
  await page.route("**/api/assets/presign", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        assetId: "00000000-0000-4000-8000-000000000701",
        uploadUrl: "/upload/reference-image",
        uploadHeaders: {},
        storageKey: "assets/reference-image.png",
        expiresAt: "2026-04-28T09:00:00.000Z"
      }
    });
  });
  await page.route("**/upload/reference-image", async (route) => {
    expect(route.request().method()).toBe("PUT");
    await route.fulfill({ status: 200 });
  });
  await page.route("**/api/assets/complete", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        id: "00000000-0000-4000-8000-000000000701",
        projectId,
        kind: "image",
        mimeType: "image/png",
        name: "参考图",
        sizeBytes: 12,
        durationMs: null,
        status: "ready",
        storageKey: "assets/reference-image.png",
        createdAt: "2026-04-28T08:00:00.000Z"
      }
    });
  });

  await page.goto("/");
  await page.getByRole("button", { exact: true, name: "资产" }).click();
  await page.getByLabel("选择上传素材").setInputFiles({ name: "参考图.png", mimeType: "image/png", buffer: Buffer.from("png") });
  await expect(page.getByRole("row", { name: /参考图.*image.*已完成/ })).toBeVisible();
  await expect(page.getByText("已完成").first()).toBeVisible();

  await page.getByTitle("生成").click();
  await page.getByRole("textbox", { name: "Prompt" }).fill("@");
  await expect(page.getByRole("listbox", { name: "资产菜单" })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("textbox", { name: "Prompt" })).toHaveValue(/@参考图/);

  await page.getByRole("textbox", { name: "Prompt" }).fill(`${"高成本生成".repeat(160)} @参考图`);
  await expect(page.getByRole("textbox", { name: "Prompt" })).toHaveValue(/@参考图/);
  await page.getByLabel("模型").selectOption("seedance-pro");
  await expect(page.getByLabel("模型")).toHaveValue("seedance-pro");
  await page.getByLabel("比例").selectOption("4:3");
  await page.getByLabel("时长").selectOption("15");
  await page.getByRole("button", { name: "预估费用" }).click();
  await expect(page.getByText("预计费用")).toBeVisible();

  await page.getByRole("main").getByRole("button", { name: "生成", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "确认高费用生成" })).toBeVisible();
  await page.getByRole("button", { name: "确认生成" }).click();
  await expect(page.getByText("排队中").first()).toBeVisible();

  expect(generation.getCreatedTaskBody()).toMatchObject({
    provider: "jimeng",
    promptText: expect.stringContaining("@参考图"),
    assetRefs: [expect.objectContaining({ id: "00000000-0000-4000-8000-000000000701", kind: "image", label: "参考图" })],
    parameters: expect.objectContaining({ modelId: "seedance-pro", aspectRatio: "4:3", durationSeconds: 15 }),
    secondConfirmToken: "confirm-token-1234567890"
  });
  expect(generation.getCreatedTaskBody()?.promptDoc).toEqual(expect.objectContaining({ type: "doc" }));
});

test("user can see a running task finish, re-edit it, and regenerate with confirmation", async ({ page }) => {
  const generation = await mockGenerationRoutes(page, [
    makeTask({
      id: "00000000-0000-4000-8000-000000000801",
      promptText: "使用 @包装主图 生成成功结果",
      status: "running",
      assetRefs: [{ id: "00000000-0000-4000-8000-000000000101", kind: "image", label: "包装主图" }]
    })
  ]);

  await page.goto("/");
  await expect(page.getByText("生成中").first()).toBeVisible();
  await expect(page.getByText("已完成").first()).toBeVisible({ timeout: 5_000 });
  await expect(page.getByRole("button", { name: "播放生成结果" })).toBeVisible({ timeout: 5_000 });

  const preview = page.getByRole("region", { name: "视频预览" });
  await preview.getByRole("button", { name: "重新编辑" }).click();
  await expect(page.getByRole("textbox", { name: "Prompt" })).toHaveValue("使用 @包装主图 生成成功结果");

  await preview.getByRole("button", { name: "再次生成" }).click();
  await expect(page.getByRole("dialog", { name: "确认再次生成" })).toBeVisible();
  await page.getByRole("button", { name: "确认再次生成" }).click();
  await expect(page.getByText("排队中").first()).toBeVisible();
  expect(generation.getRegenerateBody()).toMatchObject({
    promptText: "使用 @包装主图 生成成功结果",
    secondConfirmToken: "confirm-token-1234567890"
  });
});

test("user can switch asset and task tables", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { exact: true, name: "资产" }).click();
  await expect(page.getByRole("tab", { name: "资产库" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("cell", { name: "包装主图" })).toBeVisible();

  await page.getByRole("tab", { name: "任务列表" }).click();
  await expect(page.getByRole("tab", { name: "任务列表" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("button", { name: "复制参数" }).first()).toBeVisible();
});

test("user can search, filter, inspect, and delete assets and tasks", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { exact: true, name: "资产" }).click();

  await page.getByPlaceholder("搜索资产或任务").fill("旁白");
  await expect(page.getByRole("cell", { name: "旁白音色" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "包装主图" })).toHaveCount(0);

  await page.getByPlaceholder("搜索资产或任务").fill("");
  await page.getByLabel("筛选资产类型").selectOption("image");
  await expect(page.getByRole("cell", { name: "包装主图" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "旁白音色" })).toHaveCount(0);

  await page.getByRole("button", { name: "删除资产" }).first().click();
  await expect(page.getByRole("dialog", { name: "确认删除" })).toBeVisible();
  await expect(page.getByText("该资产被引用 5 次，请确认后删除。")).toBeVisible();
  await page.getByRole("button", { name: "删除", exact: true }).click();
  await expect(page.getByRole("cell", { name: "包装主图" })).toHaveCount(0);

  await page.getByRole("tab", { name: "任务列表" }).click();
  await page.getByLabel("筛选任务状态").selectOption("failed");
  await expect(page.getByRole("cell", { name: /当前模型不支持音频参考/ })).toBeVisible();
  await page.getByRole("button", { name: "查看任务" }).first().click();
  await expect(page.getByText("原始提示词")).toBeVisible();

  await page.getByRole("button", { name: "删除任务" }).first().click();
  await expect(page.getByRole("dialog", { name: "确认删除" })).toBeVisible();
  await page.getByRole("button", { name: "删除", exact: true }).click();
  await expect(page.getByRole("cell", { name: /当前模型不支持音频参考/ })).toHaveCount(0);
});

test("user can save and test masked API credentials", async ({ page }) => {
  let credentials: Array<{ createdAt: string; defaultModelId: null; displayName: string; id: string; maskedLabel: string; provider: "jimeng"; serviceRegion: null; updatedAt: string }> = [];

  await page.route("**/api/provider-credentials", async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      await route.fulfill({ contentType: "application/json", json: credentials });
      return;
    }

    const body = request.postDataJSON() as { displayName: string; secretKey: string };
    expect(body.secretKey).toBe("sk_secret_8f2a");
    credentials = [
      {
        id: "00000000-0000-4000-8000-000000000401",
        provider: "jimeng",
        displayName: body.displayName,
        maskedLabel: "sk-****-8F2A",
        serviceRegion: null,
        defaultModelId: null,
        createdAt: "2026-04-28T07:45:31.309Z",
        updatedAt: "2026-04-28T07:45:31.309Z"
      }
    ];
    await route.fulfill({ contentType: "application/json", json: credentials[0], status: 201 });
  });
  await page.route("**/api/provider-credentials/*/test", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        credentialId: "00000000-0000-4000-8000-000000000401",
        ok: true,
        checkedAt: "2026-04-28T07:45:31.309Z",
        message: "凭证已保存并可解密。真实连通性将在接入即梦 Provider 后检测。"
      }
    });
  });

  await page.goto("/");
  await page.getByRole("button", { exact: true, name: "API" }).click();
  await page.getByPlaceholder("提交后前端会清空").fill("ak_demo");
  await page.getByPlaceholder("提交后不再明文展示").fill("sk_secret_8f2a");
  await page.getByRole("button", { name: "保存凭证" }).click();

  await expect(page.getByText("凭证已保存。前端已清空 API Key 和 Secret Key。")).toBeVisible();
  await expect(page.getByText("sk-****-8F2A")).toBeVisible();
  await expect(page.getByText("sk_secret_8f2a")).toHaveCount(0);

  await page.getByRole("button", { name: "检测连接" }).click();
  await expect(page.getByText("凭证已保存并可解密。真实连通性将在接入即梦 Provider 后检测。")).toBeVisible();
});

test("user can use login and API Key login states", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "登录影栈 Studio" })).toBeVisible();
  await page.getByRole("textbox", { name: "邮箱" }).fill("creator@example.com");
  await page.getByLabel("密码").fill("bad-password");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.getByRole("button", { name: "登录中..." })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("登录失败，请检查邮箱和密码");
  await expect(page.getByRole("textbox", { name: "邮箱" })).toHaveValue("creator@example.com");

  await page.getByRole("tab", { name: "使用 API Key 登录" }).click();
  await expect(page.getByRole("textbox", { name: "服务区域" })).toHaveValue("cn-north-1");
  await page.getByRole("textbox", { name: "API Key" }).fill("ak_demo");
  await page.getByLabel("Secret Key").fill("sk_secret");
  await page.getByRole("button", { name: "验证并登录" }).click();
  await expect(page.getByRole("button", { name: "登录中..." })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("API Key 登录失败");
  await expect(page.getByLabel("Secret Key")).toHaveValue("");
});
