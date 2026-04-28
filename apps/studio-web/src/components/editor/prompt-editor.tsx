import { FileAudio2, Image, Paperclip } from "lucide-react";
import type { AssetMention } from "@video-stack/shared";

export function PromptEditor({
  prompt,
  assets,
  onPromptChange
}: {
  prompt: string;
  assets: AssetMention[];
  onPromptChange(prompt: string): void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground" htmlFor="prompt-editor">
          Prompt
        </label>
        <span className="text-xs text-muted-foreground">{prompt.length}/4000</span>
      </div>
      <div className="flex gap-2">
        {assets.map((asset, index) => {
          const Icon = asset.kind === "audio" ? FileAudio2 : Image;
          return (
            <button
              aria-label={`引用${asset.label}`}
              className="grid size-12 place-items-center rounded-md border border-border bg-muted text-muted-foreground transition hover:border-primary hover:text-primary"
              key={asset.id}
              title={asset.label}
              type="button"
            >
              <Icon className="size-4" aria-hidden="true" />
              <span className="sr-only">{index + 1}</span>
            </button>
          );
        })}
      </div>
      <textarea
        id="prompt-editor"
        aria-label="Prompt"
        value={prompt}
        onChange={(event) => onPromptChange(event.target.value)}
        placeholder="描述镜头、节奏、字幕和素材引用，例如 @包装主图 微距旋转，柔和灯光。"
        className="studio-scrollbar max-h-[34vh] min-h-24 w-full resize-none rounded-md border border-border bg-input p-3 text-sm leading-6 text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary"
      />
      <div className="flex flex-wrap gap-2">
        {assets.map((asset) => (
          <span
            className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-muted px-2 text-xs text-muted-foreground"
            key={asset.id}
          >
            <Paperclip className="size-3" aria-hidden="true" />
            @{asset.label}
          </span>
        ))}
      </div>
    </div>
  );
}
