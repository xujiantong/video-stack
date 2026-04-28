import { expect, test } from "@playwright/test";

test("user can estimate and create a generation task", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Prompt" }).fill("生成 8 秒产品展示视频");
  await page.getByRole("button", { name: "预估费用" }).click();
  await expect(page.getByText("预计费用")).toBeVisible();
  await page.getByRole("main").getByRole("button", { name: "生成", exact: true }).click();
  await expect(page.getByText("排队中").first()).toBeVisible();
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
