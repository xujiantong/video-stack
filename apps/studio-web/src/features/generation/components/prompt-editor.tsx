import { FileAudio2, Image, Paperclip } from "lucide-react";
import type { AssetMention } from "@video-stack/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

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
        <label className="text-xs font-medium uppercase text-muted-foreground" htmlFor="prompt-editor">
          Prompt
        </label>
        <span className="text-xs text-muted-foreground">{prompt.length}/4000</span>
      </div>
      <div className="flex gap-2">
        {assets.map((asset, index) => {
          const Icon = asset.kind === "audio" ? FileAudio2 : Image;
          return (
            <Button
              aria-label={`引用${asset.label}`}
              className="size-12 px-0 text-muted-foreground hover:text-primary"
              key={asset.id}
              title={asset.label}
              type="button"
              variant="secondary"
            >
              <Icon className="size-4" aria-hidden="true" />
              <span className="sr-only">{index + 1}</span>
            </Button>
          );
        })}
      </div>
      <Textarea
        id="prompt-editor"
        aria-label="Prompt"
        value={prompt}
        onChange={(event) => onPromptChange(event.target.value)}
        placeholder="描述镜头、节奏、字幕和素材引用，例如 @包装主图 微距旋转，柔和灯光。"
        className="max-h-[34vh] min-h-24"
      />
      <div className="flex flex-wrap gap-2">
        {assets.map((asset) => (
          <Badge className="h-7" key={asset.id}>
            <Paperclip className="size-3" aria-hidden="true" />
            @{asset.label}
          </Badge>
        ))}
      </div>
    </div>
  );
}
