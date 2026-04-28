import { describe, expect, it } from "vitest";
import { createJimengAdapter } from "./adapter";

describe("jimeng adapter", () => {
  it("estimates generation cost from prompt and asset count", async () => {
    const adapter = createJimengAdapter();

    await expect(adapter.estimate({ promptText: "生成产品视频", assetUrls: ["https://example.com/a.png"] })).resolves.toEqual({
      estimatedCostCents: 300,
      estimatedSeconds: 45
    });
  });
});
