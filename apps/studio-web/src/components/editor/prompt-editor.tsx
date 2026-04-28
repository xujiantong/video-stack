import { Paperclip } from "lucide-react";
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
      <label className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground" htmlFor="prompt-editor">
        Prompt
      </label>
      <textarea
        id="prompt-editor"
        aria-label="Prompt"
        value={prompt}
        onChange={(event) => onPromptChange(event.target.value)}
        placeholder="描述镜头、节奏、字幕和素材引用"
        className="h-28 w-full resize-none rounded-md border border-border bg-input p-3 text-sm leading-6 text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary"
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
