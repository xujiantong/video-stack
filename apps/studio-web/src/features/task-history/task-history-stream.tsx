import { CheckCircle2, CircleDashed, Clock3, MoreHorizontal, PenLine, Play, RefreshCcw, XCircle } from "lucide-react";
import type { GenerationTask } from "@video-stack/shared";
import { statusLabel } from "@/components/domain/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const statusTone: Record<GenerationTask["status"], "muted" | "primary" | "warning" | "danger" | "success"> = {
  draft: "muted",
  queued: "warning",
  running: "primary",
  succeeded: "success",
  failed: "danger",
  canceled: "muted"
};

function StatusIcon({ status }: { status: GenerationTask["status"] }) {
  if (status === "succeeded") return <CheckCircle2 className="size-4 text-success" aria-hidden="true" />;
  if (status === "failed" || status === "canceled") return <XCircle className="size-4 text-danger" aria-hidden="true" />;
  if (status === "running") return <CircleDashed className="size-4 text-primary" aria-hidden="true" />;
  return <Clock3 className="size-4 text-warning" aria-hidden="true" />;
}

export function TaskHistoryStream({ tasks }: { tasks: GenerationTask[] }) {
  return (
    <div className="mx-auto max-w-6xl space-y-3 p-4 pb-28">
      <div className="grid gap-2 md:grid-cols-2">
        {tasks.map((task) => (
          <article className="overflow-hidden rounded-card border border-border bg-surface" key={task.id}>
            <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-3">
              <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
                <span className="flex -space-x-2">
                  <span className="grid size-7 place-items-center rounded-button border border-border bg-muted text-[10px]">图1</span>
                  <span className="grid size-7 place-items-center rounded-button border border-border bg-muted text-[10px]">音1</span>
                </span>
                <span className="line-clamp-1">{task.promptText}</span>
              </div>
              <Badge className="shrink-0" tone={statusTone[task.status]}>
                <StatusIcon status={task.status} />
                {statusLabel[task.status]}
              </Badge>
            </div>
            <div className="aspect-video bg-background">
              <div className="studio-preview-bg grid h-full place-items-center">
                {task.status === "succeeded" ? (
                  <span className="grid size-12 place-items-center rounded-full bg-primary text-primary-foreground">
                    <Play className="size-5 fill-current" aria-hidden="true" />
                  </span>
                ) : (
                  <StatusIcon status={task.status} />
                )}
              </div>
            </div>
            <div className="space-y-3 p-3">
              <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground">
                <span>Seedance</span>
                <span>16:9</span>
                <span>1080P</span>
                <span>15s</span>
              </div>
              {task.errorMessage ? <p className="rounded-card bg-danger/10 p-2 text-xs leading-5 text-danger">{task.errorMessage}</p> : null}
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-warning">¥{(task.estimatedCostCents / 100).toFixed(2)}</span>
                <div className="flex gap-2">
                  <Button className="h-8 px-2 text-xs" type="button" variant="secondary">
                    <PenLine className="size-3" aria-hidden="true" />
                    重新编辑
                  </Button>
                  <Button className="h-8 px-2 text-xs" type="button" variant="secondary">
                    <RefreshCcw className="size-3" aria-hidden="true" />
                    再次生成
                  </Button>
                  <Button aria-label="更多操作" className="size-8 px-0" type="button" variant="ghost">
                    <MoreHorizontal className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
