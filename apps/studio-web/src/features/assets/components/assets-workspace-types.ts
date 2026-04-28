import type { GenerationTask } from "@video-stack/shared";
import type { StudioAsset } from "@/lib/stores/composer-store";

export type AssetTab = "assets" | "tasks";
export type AssetFilter = "all" | StudioAsset["fileType"];
export type TaskFilter = "all" | GenerationTask["status"];

export type PendingDelete =
  | { type: "asset"; id: string; label: string; references: number }
  | { type: "task"; id: string; label: string };
