import type { GenerationTask } from "@video-stack/shared";
import { cn } from "@/lib/utils";

const statusClass: Record<GenerationTask["status"], string> = {
  draft: "border-border bg-muted text-muted-foreground",
  queued: "border-border bg-muted text-muted-foreground",
  running: "border-primary/40 bg-primary/10 text-primary",
  succeeded: "border-success/40 bg-success/10 text-success",
  failed: "border-danger/40 bg-danger/10 text-danger",
  canceled: "border-border bg-muted text-muted-foreground"
};

export const statusLabel: Record<GenerationTask["status"], string> = {
  draft: "草稿",
  queued: "排队中",
  running: "生成中",
  succeeded: "已完成",
  failed: "失败",
  canceled: "已取消"
};

export function StatusBadge({ status }: { status: GenerationTask["status"] }) {
  return <span className={cn("w-fit rounded-button border px-2 py-1 text-xs", statusClass[status])}>{statusLabel[status]}</span>;
}
