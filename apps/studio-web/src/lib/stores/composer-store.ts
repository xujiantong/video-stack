import { create } from "zustand";
import type { AssetMention, GenerationTask } from "@video-stack/shared";

type ComposerState = {
  prompt: string;
  assets: AssetMention[];
  tasks: GenerationTask[];
  setPrompt(prompt: string): void;
  addTask(task: GenerationTask): void;
};

const now = new Date().toISOString();

export const useComposerStore = create<ComposerState>((set) => ({
  prompt: "生成 8 秒产品展示视频，突出包装细节和柔和灯光。",
  assets: [
    {
      id: "00000000-0000-4000-8000-000000000101",
      kind: "image",
      label: "包装主图"
    }
  ],
  tasks: [
    {
      id: "00000000-0000-4000-8000-000000000201",
      projectId: "00000000-0000-4000-8000-000000000001",
      provider: "jimeng",
      promptText: "生成 8 秒产品展示视频",
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
      assetRefs: [],
      status: "running",
      estimatedCostCents: 1120,
      actualCostCents: null,
      requiresSecondConfirm: false,
      resultAssetId: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now
    }
  ],
  setPrompt(prompt) {
    set({ prompt });
  },
  addTask(task) {
    set((state) => ({ tasks: [task, ...state.tasks] }));
  }
}));
