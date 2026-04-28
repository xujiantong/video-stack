import { expect, test } from "@playwright/test";

test("user can estimate and create a generation task", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Prompt" }).fill("生成 8 秒产品展示视频");
  await page.getByRole("button", { name: "预估费用" }).click();
  await expect(page.getByText("预计费用")).toBeVisible();
  await page.getByRole("button", { name: "生成" }).click();
  await expect(page.getByText("排队中").first()).toBeVisible();
});
