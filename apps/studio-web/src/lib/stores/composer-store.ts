import { create } from "zustand";
import { DEFAULT_GENERATION_PARAMETERS, type AssetMention, type GenerationParameters, type GenerationTask } from "@video-stack/shared";

export type StudioView = "inspiration" | "generate" | "assets" | "settings" | "api";

export type StudioAsset = AssetMention & {
  fileType: "image" | "audio" | "video";
  sizeLabel: string;
  references: number;
  createdAt: string;
  status: "ready" | "uploading" | "failed";
  previewUrl?: string;
  uploadError?: string;
};

type ComposerState = {
  view: StudioView;
  prompt: string;
  promptDoc: Record<string, unknown>;
  assetRefs: AssetMention[];
  parameters: GenerationParameters;
  assets: StudioAsset[];
  tasks: GenerationTask[];
  setView(view: StudioView): void;
  setPrompt(prompt: string): void;
  setPromptDoc(promptDoc: Record<string, unknown>, assetRefs: AssetMention[], promptText: string): void;
  setParameters(parameters: GenerationParameters): void;
  upsertAsset(asset: StudioAsset): void;
  setAssetStatus(assetId: string, status: StudioAsset["status"], uploadError?: string): void;
  removeAsset(assetId: string): void;
  addTask(task: GenerationTask): void;
};

const now = new Date().toISOString();

export const useComposerStore = create<ComposerState>((set) => ({
  view: "generate",
  prompt: "生成 8 秒产品展示视频，突出包装细节和柔和灯光。",
  promptDoc: { type: "doc", content: [{ type: "text", text: "生成 8 秒产品展示视频，突出包装细节和柔和灯光。" }] },
  assetRefs: [],
  parameters: DEFAULT_GENERATION_PARAMETERS,
  assets: [
    {
      id: "00000000-0000-4000-8000-000000000101",
      kind: "image",
      label: "包装主图",
      fileType: "image",
      sizeLabel: "2.4 MB",
      references: 5,
      createdAt: "今天 10:12",
      status: "ready"
    },
    {
      id: "00000000-0000-4000-8000-000000000102",
      kind: "image",
      label: "场景参考",
      fileType: "image",
      sizeLabel: "3.1 MB",
      references: 3,
      createdAt: "今天 10:18",
      status: "uploading"
    },
    {
      id: "00000000-0000-4000-8000-000000000103",
      kind: "audio",
      label: "旁白音色",
      fileType: "audio",
      sizeLabel: "8.6 MB",
      references: 2,
      createdAt: "昨天 21:45",
      status: "ready"
    }
  ],
  tasks: [
    {
      id: "00000000-0000-4000-8000-000000000201",
      projectId: "00000000-0000-4000-8000-000000000001",
      provider: "jimeng",
      promptText: "生成 8 秒产品展示视频",
      parameters: DEFAULT_GENERATION_PARAMETERS,
      assetRefs: [],
      status: "succeeded",
      estimatedCostCents: 860,
      actualCostCents: 860,
      requiresSecondConfirm: false,
      resultAssetId: "00000000-0000-4000-8000-000000000301",
      errorMessage: null,
      createdAt: now,
      updatedAt: now
    },
    {
      id: "00000000-0000-4000-8000-000000000202",
      projectId: "00000000-0000-4000-8000-000000000001",
      provider: "jimeng",
      promptText: "把镜头改成俯拍，增加字幕",
      parameters: DEFAULT_GENERATION_PARAMETERS,
      assetRefs: [],
      status: "running",
      estimatedCostCents: 1120,
      actualCostCents: null,
      requiresSecondConfirm: false,
      resultAssetId: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now
    },
    {
      id: "00000000-0000-4000-8000-000000000203",
      projectId: "00000000-0000-4000-8000-000000000001",
      provider: "jimeng",
      promptText: "使用 @包装主图 展示产品旋转，镜头从微距拉到全景。",
      parameters: DEFAULT_GENERATION_PARAMETERS,
      assetRefs: [],
      status: "queued",
      estimatedCostCents: 1480,
      actualCostCents: null,
      requiresSecondConfirm: false,
      resultAssetId: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now
    },
    {
      id: "00000000-0000-4000-8000-000000000204",
      projectId: "00000000-0000-4000-8000-000000000001",
      provider: "jimeng",
      promptText: "当前模型不支持音频参考，请移除 @旁白音色 或切换模型。",
      parameters: DEFAULT_GENERATION_PARAMETERS,
      assetRefs: [],
      status: "failed",
      estimatedCostCents: 980,
      actualCostCents: null,
      requiresSecondConfirm: false,
      resultAssetId: null,
      errorMessage: "当前模型不支持音频参考，请移除音频或切换模型。",
      createdAt: now,
      updatedAt: now
    }
  ],
  setView(view) {
    set({ view });
  },
  setPrompt(prompt) {
    set({ prompt });
  },
  setPromptDoc(promptDoc, assetRefs, promptText) {
    set({ promptDoc, assetRefs, prompt: promptText });
  },
  setParameters(parameters) {
    set({ parameters });
  },
  upsertAsset(asset) {
    set((state) => {
      const existingIndex = state.assets.findIndex((row) => row.id === asset.id);
      if (existingIndex < 0) {
        return { assets: [asset, ...state.assets] };
      }
      const nextAssets = [...state.assets];
      nextAssets[existingIndex] = { ...nextAssets[existingIndex], ...asset };
      return { assets: nextAssets };
    });
  },
  setAssetStatus(assetId, status, uploadError) {
    set((state) => ({
      assets: state.assets.map((asset) =>
        asset.id === assetId
          ? status === "failed"
            ? {
                ...asset,
                status,
                uploadError: uploadError ?? "上传失败，请重试。"
              }
            : (() => {
                const { uploadError: _uploadError, ...rest } = asset;
                return { ...rest, status };
              })()
          : asset
      )
    }));
  },
  removeAsset(assetId) {
    set((state) => ({ assets: state.assets.filter((asset) => asset.id !== assetId) }));
  },
  addTask(task) {
    set((state) => ({ tasks: [task, ...state.tasks] }));
  }
}));
