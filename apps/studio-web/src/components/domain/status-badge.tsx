import type { GenerationTask } from "@video-stack/shared";
import { Badge } from "@/components/ui/badge";

const statusTone: Record<GenerationTask["status"], "muted" | "primary" | "danger" | "success"> = {
  draft: "muted",
  queued: "muted",
  running: "primary",
  succeeded: "success",
  failed: "danger",
  canceled: "muted"
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
  return <Badge tone={statusTone[status]}>{statusLabel[status]}</Badge>;
}
