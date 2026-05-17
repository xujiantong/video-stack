import { create } from "zustand";
import { DEFAULT_GENERATION_PARAMETERS, type AssetMention, type GenerationParameters } from "@video-stack/shared";

export type StudioView = "generate" | "assets" | "canvas" | "settings" | "api" | "login";

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
  setView(view: StudioView): void;
  setPrompt(prompt: string): void;
  setPromptDoc(promptDoc: Record<string, unknown>, assetRefs: AssetMention[], promptText: string): void;
  setParameters(parameters: GenerationParameters): void;
  setAssets(assets: StudioAsset[]): void;
  upsertAsset(asset: StudioAsset): void;
  setAssetStatus(assetId: string, status: StudioAsset["status"], uploadError?: string): void;
  removeAsset(assetId: string): void;
};

export const useComposerStore = create<ComposerState>((set) => ({
  view: "generate",
  prompt: "生成 8 秒产品展示视频，突出包装细节和柔和灯光。",
  promptDoc: { type: "doc", content: [{ type: "text", text: "生成 8 秒产品展示视频，突出包装细节和柔和灯光。" }] },
  assetRefs: [],
  parameters: DEFAULT_GENERATION_PARAMETERS,
  assets: [],
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
  setAssets(assets) {
    set((state) => {
      const assetIds = new Set(assets.map((asset) => asset.id));
      return {
        assets,
        assetRefs: state.assetRefs.filter((assetRef) => assetIds.has(assetRef.id))
      };
    });
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
  }
}));
