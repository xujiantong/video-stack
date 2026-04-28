import { useMemo, useRef, useState } from "react";
import { FileAudio2, Image, Paperclip } from "lucide-react";
import type { AssetMention } from "@video-stack/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type PromptInlineNode =
  | { type: "text"; text: string }
  | { type: "asset"; assetId: string; label: string; kind: AssetMention["kind"] };

export function buildPromptDoc(promptText: string, assets: AssetMention[]): { promptDoc: Record<string, unknown>; assetRefs: AssetMention[] } {
  if (assets.length === 0) return { promptDoc: { type: "doc", content: [{ type: "text", text: promptText }] }, assetRefs: [] };

  const labelsByLength = [...assets].sort((a, b) => b.label.length - a.label.length);
  const nodes: PromptInlineNode[] = [];
  const assetRefs: AssetMention[] = [];
  const seenAssetIds = new Set<string>();

  let cursor = 0;
  while (cursor < promptText.length) {
    const atIndex = promptText.indexOf("@", cursor);
    if (atIndex < 0) {
      const tail = promptText.slice(cursor);
      if (tail) nodes.push({ type: "text", text: tail });
      break;
    }

    if (atIndex > cursor) {
      nodes.push({ type: "text", text: promptText.slice(cursor, atIndex) });
    }

    const match = labelsByLength.find((asset) => promptText.startsWith(`@${asset.label}`, atIndex));
    if (!match) {
      nodes.push({ type: "text", text: "@" });
      cursor = atIndex + 1;
      continue;
    }

    nodes.push({ type: "asset", assetId: match.id, label: match.label, kind: match.kind });
    if (!seenAssetIds.has(match.id)) {
      assetRefs.push({ id: match.id, kind: match.kind, label: match.label });
      seenAssetIds.add(match.id);
    }
    cursor = atIndex + 1 + match.label.length;
  }

  return {
    promptDoc: { type: "doc", content: nodes },
    assetRefs
  };
}

export function PromptEditor({
  prompt,
  promptDoc,
  assets,
  assetRefs,
  onPromptDocChange
}: {
  prompt: string;
  assets: AssetMention[];
  promptDoc: Record<string, unknown>;
  assetRefs: AssetMention[];
  onPromptDocChange(promptDoc: Record<string, unknown>, assetRefs: AssetMention[], promptText: string): void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [mentionQuery, setMentionQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const menuId = "prompt-asset-menu";

  const menuAssets = useMemo(() => {
    const q = mentionQuery.trim().toLowerCase();
    const list = q.length === 0 ? assets : assets.filter((asset) => asset.label.toLowerCase().includes(q));
    return list.slice(0, 8);
  }, [assets, mentionQuery]);
  const activeOptionId = mentionOpen && menuAssets[activeIndex] ? `${menuId}-${menuAssets[activeIndex].id}` : undefined;

  function closeMentionMenu() {
    setMentionOpen(false);
    setMentionStart(null);
    setMentionQuery("");
    setActiveIndex(0);
  }

  function syncDoc(nextPrompt: string) {
    const built = buildPromptDoc(nextPrompt, assets);
    onPromptDocChange(built.promptDoc, built.assetRefs, nextPrompt);
  }

  function handleChange(nextPrompt: string) {
    syncDoc(nextPrompt);

    const el = textareaRef.current;
    if (!el) return;
    const caret = el.selectionStart ?? nextPrompt.length;
    const slice = nextPrompt.slice(0, caret);
    const at = slice.lastIndexOf("@");
    if (at < 0) {
      closeMentionMenu();
      return;
    }
    const afterAt = slice.slice(at + 1);
    if (/\s/.test(afterAt)) {
      closeMentionMenu();
      return;
    }
    setMentionOpen(true);
    setMentionStart(at);
    setMentionQuery(afterAt);
    setActiveIndex(0);
  }

  function insertMention(asset: AssetMention) {
    const el = textareaRef.current;
    if (!el) return;
    const caret = el.selectionStart ?? prompt.length;
    const start = mentionStart ?? caret;
    const nextPrompt = `${prompt.slice(0, start)}@${asset.label} ${prompt.slice(caret)}`;
    syncDoc(nextPrompt);
    closeMentionMenu();

    requestAnimationFrame(() => {
      el.focus();
      const nextCaret = start + asset.label.length + 2;
      el.setSelectionRange(nextCaret, nextCaret);
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs font-medium uppercase text-muted-foreground" htmlFor="prompt-editor">
          Prompt
        </label>
        <span className="text-xs text-muted-foreground">{prompt.length}/4000</span>
      </div>
      <div className="flex gap-2">
        {assetRefs.map((asset, index) => {
          const Icon = asset.kind === "audio" ? FileAudio2 : Image;
          return (
            <Button
              aria-label={`引用${asset.label}`}
              className="size-10 px-0 text-muted-foreground hover:text-primary"
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
      <div className="relative">
        <Textarea
          ref={textareaRef}
          id="prompt-editor"
          aria-label="Prompt"
          aria-activedescendant={activeOptionId}
          aria-controls={mentionOpen ? menuId : undefined}
          aria-expanded={mentionOpen}
          aria-haspopup="listbox"
          value={prompt}
          onChange={(event) => handleChange(event.target.value)}
          onKeyDown={(event) => {
            if (!mentionOpen) return;
            if (event.key === "Escape") {
              event.preventDefault();
              closeMentionMenu();
              return;
            }
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((value) => Math.min(value + 1, Math.max(0, menuAssets.length - 1)));
              return;
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((value) => Math.max(value - 1, 0));
              return;
            }
            if (event.key === "Enter") {
              event.preventDefault();
              const active = menuAssets[activeIndex];
              if (active) insertMention(active);
            }
          }}
          placeholder="描述镜头、节奏、字幕和素材引用，例如 @包装主图 微距旋转，柔和灯光。"
          className="max-h-[20vh] min-h-20"
        />
        {mentionOpen ? (
          <div
            id={menuId}
            className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-popover border border-border bg-surface-raised shadow-popover"
            role="listbox"
            aria-label="资产菜单"
          >
            {menuAssets.length === 0 ? (
              <div aria-disabled="true" className="px-3 py-2 text-sm text-muted-foreground" role="option">
                没有匹配的资产，请先上传参考内容。
              </div>
            ) : (
              menuAssets.map((asset, index) => {
                const active = index === activeIndex;
                return (
                  <button
                    key={asset.id}
                    id={`${menuId}-${asset.id}`}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                      active ? "bg-muted/60 text-primary" : "text-foreground hover:bg-muted/40"
                    )}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      insertMention(asset);
                    }}
                  >
                    <span className="text-muted-foreground">@</span>
                    <span className="truncate">{asset.label}</span>
                  </button>
                );
              })
            )}
          </div>
        ) : null}
        <span className="sr-only">{JSON.stringify(promptDoc)}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {assetRefs.map((asset) => (
          <Badge className="h-7" key={asset.id}>
            <Paperclip className="size-3" aria-hidden="true" />
            @{asset.label}
          </Badge>
        ))}
      </div>
    </div>
  );
}
