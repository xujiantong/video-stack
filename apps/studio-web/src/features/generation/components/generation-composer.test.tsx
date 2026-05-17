import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_GENERATION_PARAMETERS } from "@video-stack/shared";
import { GenerationComposer } from "./generation-composer";
import { buildPromptDoc } from "./prompt-editor";
import { useComposerStore, type StudioAsset } from "@/lib/stores/composer-store";

const projectId = "00000000-0000-4000-8000-000000000001";
const sampleAssets: StudioAsset[] = [
  {
    id: "00000000-0000-4000-8000-000000000101",
    kind: "image",
    label: "包装主图",
    fileType: "image",
    sizeLabel: "120 KB",
    references: 0,
    createdAt: "刚刚",
    status: "ready",
    previewUrl: "/api/assets/00000000-0000-4000-8000-000000000101/content"
  },
  {
    id: "00000000-0000-4000-8000-000000000102",
    kind: "image",
    label: "场景参考",
    fileType: "image",
    sizeLabel: "98 KB",
    references: 0,
    createdAt: "刚刚",
    status: "uploading"
  },
  {
    id: "00000000-0000-4000-8000-000000000103",
    kind: "audio",
    label: "旁白音色",
    fileType: "audio",
    sizeLabel: "1 MB",
    references: 0,
    createdAt: "刚刚",
    status: "ready"
  }
];

function renderComposer() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <GenerationComposer />
    </QueryClientProvider>
  );
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

function stubGenerationFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/api/models")) {
        return jsonResponse([
          {
            id: "seedance-lite",
            provider: "jimeng",
            displayName: "即梦AI-视频生成3.0 720P",
            enabled: true,
            supportedModes: ["text_to_video", "image_to_video"],
            supportedAspectRatios: ["16:9"],
            supportedResolutions: ["720p"],
            supportedDurations: [5],
            maxPromptLength: 4000,
            maxImageAssets: 1,
            pricing: { baseCostCents: 0, perSecondCents: 0, perAssetCents: 0 }
          }
        ]);
      }
      if (url.includes("/api/assets?")) return jsonResponse([]);
      if (url.includes("/api/assets/presign")) {
        return jsonResponse({
          assetId: "00000000-0000-4000-8000-000000000301",
          uploadUrl: "/api/assets/uploads/project%2Fasset.png",
          uploadHeaders: {},
          storageKey: "project/asset.png",
          expiresAt: "2026-04-28T08:10:00.000Z"
        });
      }
      if (url.includes("/api/assets/uploads/")) return jsonResponse({ ok: true });
      if (url.includes("/api/assets/complete")) {
        return jsonResponse({
          id: "00000000-0000-4000-8000-000000000301",
          projectId,
          kind: "image",
          mimeType: "image/png",
          name: "包装主图.png",
          sizeBytes: 12,
          durationMs: null,
          status: "ready",
          storageKey: "project/asset.png",
          createdAt: "2026-04-28T08:00:00.000Z"
        });
      }
      if (url.includes("/api/generation/estimate")) {
        return jsonResponse({
          estimatedCostCents: 0,
          estimatedSeconds: 30,
          requiresSecondConfirm: false,
          costBreakdown: { baseCostCents: 0, durationCostCents: 0, assetCostCents: 0 }
        });
      }
      if (url.includes("/api/generation/tasks") && init?.method === "POST") {
        return jsonResponse({
          id: "00000000-0000-4000-8000-000000000202",
          projectId,
          provider: "jimeng",
          promptText: "生成 8 秒产品展示视频",
          parameters: DEFAULT_GENERATION_PARAMETERS,
          assetRefs: [],
          status: "queued",
          estimatedCostCents: 0,
          actualCostCents: null,
          requiresSecondConfirm: false,
          resultAssetId: null,
          errorMessage: null,
          createdAt: "2026-04-28T08:00:00.000Z",
          updatedAt: "2026-04-28T08:00:00.000Z"
        });
      }
      return jsonResponse([]);
    })
  );
}

beforeEach(() => {
  useComposerStore.setState({
    assetRefs: [],
    assets: sampleAssets,
    parameters: DEFAULT_GENERATION_PARAMETERS,
    prompt: "生成 8 秒产品展示视频，突出包装细节和柔和灯光。",
    promptDoc: { type: "doc", content: [{ type: "text", text: "生成 8 秒产品展示视频，突出包装细节和柔和灯光。" }] }
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("GenerationComposer", () => {
  it("inserts a sidebar asset reference into the prompt", async () => {
    useComposerStore.setState({
      assets: sampleAssets,
      parameters: { ...DEFAULT_GENERATION_PARAMETERS, mode: "image_to_video", referenceMode: "image" }
    });
    renderComposer();

    fireEvent.click(await screen.findByRole("button", { name: "引用第一个资产" }));

    expect(screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Prompt" }).value).toContain("@包装主图");
  });

  it("keeps repeated asset mentions unique in the payload references", () => {
    const built = buildPromptDoc("@包装主图 拉近，随后再次使用 @包装主图。", [
      { id: "00000000-0000-4000-8000-000000000101", kind: "image", label: "包装主图" }
    ]);

    expect(built.assetRefs).toEqual([{ id: "00000000-0000-4000-8000-000000000101", kind: "image", label: "包装主图" }]);
  });

  it("estimates cost and creates a queued task", async () => {
    stubGenerationFetch();
    renderComposer();

    fireEvent.change(screen.getByRole("textbox", { name: "Prompt" }), {
      target: { value: "生成 8 秒产品展示视频" }
    });
    fireEvent.click(screen.getByRole("button", { name: "预估" }));

    await waitFor(() => expect(screen.getByText("预计消耗")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "生成" }));

    await waitFor(() => expect(screen.getByText("预计消耗")).toBeInTheDocument());
  });

  it("shows all enabled Jimeng video 3.0 models", async () => {
    renderComposer();

    const modelSelect = await screen.findByLabelText("模型");

    expect(modelSelect).toHaveTextContent("即梦AI-视频生成3.0 720P");
    expect(modelSelect).toHaveTextContent("即梦AI-视频生成3.0 1080P");
    expect(modelSelect).toHaveTextContent("即梦AI-视频生成3.0 Pro 1080P");
    expect(screen.getByLabelText<HTMLSelectElement>("参考模式").value).toBe("none");
    expect(screen.getByLabelText<HTMLSelectElement>("比例").value).toBe("16:9");
    expect(screen.getByLabelText<HTMLSelectElement>("时长").value).toBe("5");
  });

  it("does not offer asset references for text-to-video", async () => {
    renderComposer();

    expect(await screen.findByText("文生视频不使用参考资产。切到图生视频、参考图或首尾帧后，可以引用图片资产。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "引用第一个资产" })).toBeDisabled();
  });

  it("shows all assets in the mention menu with unavailable reasons", async () => {
    useComposerStore.setState({
      assets: sampleAssets,
      parameters: { ...DEFAULT_GENERATION_PARAMETERS, mode: "image_to_video", referenceMode: "image" }
    });
    renderComposer();

    fireEvent.change(screen.getByRole("textbox", { name: "Prompt" }), {
      target: { value: "@" }
    });

    expect(await screen.findByRole("option", { name: /包装主图/ })).toBeInTheDocument();
    expect(screen.getByText("场景参考")).toBeInTheDocument();
    expect(screen.getAllByText("上传中").length).toBeGreaterThan(0);
    expect(screen.getByText("旁白音色")).toBeInTheDocument();
    expect(screen.getAllByText("仅支持图片").length).toBeGreaterThan(0);
  });

  it("uploads a local reference file into assets and references it when supported", async () => {
    stubGenerationFetch();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:preview")
    });
    useComposerStore.setState({
      assets: [],
      parameters: { ...DEFAULT_GENERATION_PARAMETERS, mode: "image_to_video", referenceMode: "image" }
    });
    renderComposer();

    fireEvent.change(screen.getByLabelText("选择本地参考内容"), {
      target: { files: [new File(["image-bytes"], "包装主图.png", { type: "image/png" })] }
    });

    await waitFor(() => {
      expect(screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Prompt" }).value).toContain("@包装主图");
    });
    expect(useComposerStore.getState().assets.find((asset) => asset.label === "包装主图")?.status).toBe("ready");
  });

  it("creates a free 720P task without high cost confirmation", async () => {
    stubGenerationFetch();
    renderComposer();

    fireEvent.change(screen.getByRole("textbox", { name: "Prompt" }), {
      target: { value: "高成本生成".repeat(300) }
    });
    fireEvent.click(screen.getByRole("button", { name: "生成" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "确认高费用生成" })).not.toBeInTheDocument());
    expect(screen.getAllByText("预计消耗").length).toBeGreaterThan(0);
  });
});
