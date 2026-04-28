import { FileAudio2, Film, Image } from "lucide-react";
import type { StudioAsset } from "@/lib/stores/composer-store";

export function AssetIcon({ asset }: { asset: StudioAsset }) {
  const Icon = asset.fileType === "audio" ? FileAudio2 : asset.fileType === "video" ? Film : Image;
  return (
    <span className="grid size-10 place-items-center rounded-card border border-border bg-muted text-primary">
      <Icon className="size-4" aria-hidden="true" />
    </span>
  );
}
