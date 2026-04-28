import { FileAudio2, Film, Image } from "lucide-react";
import type { StudioAsset } from "@/lib/stores/composer-store";

export function AssetIcon({ asset }: { asset: StudioAsset }) {
  const Icon = asset.fileType === "audio" ? FileAudio2 : asset.fileType === "video" ? Film : Image;
  if (asset.fileType === "image" && asset.previewUrl) {
    return (
      <span className="relative grid size-10 overflow-hidden rounded-card border border-border bg-muted">
        <img alt={asset.label} className="h-full w-full object-cover" src={asset.previewUrl} />
      </span>
    );
  }
  return (
    <span className="grid size-10 place-items-center rounded-card border border-border bg-muted text-primary">
      <Icon className="size-4" aria-hidden="true" />
    </span>
  );
}
