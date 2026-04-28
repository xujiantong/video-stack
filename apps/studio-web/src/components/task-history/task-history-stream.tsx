import { CheckCircle2, CircleDashed, Clock3, MoreHorizontal, PenLine, Play, RefreshCcw, XCircle } from "lucide-react";
import type { GenerationTask } from "@video-stack/shared";
import { Button } from "@/components/ui/button";

const statusLabel: Record<GenerationTask["status"], string> = {
  draft: "草稿",
  queued: "排队中",
  running: "运行中",
  succeeded: "已完成",
  failed: "失败",
  canceled: "已取消"
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
          <article className="overflow-hidden rounded-md border border-border bg-surface" key={task.id}>
            <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-3">
              <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
                <span className="flex -space-x-2">
                  <span className="grid size-7 place-items-center rounded-md border border-border bg-muted text-[10px]">图1</span>
                  <span className="grid size-7 place-items-center rounded-md border border-border bg-muted text-[10px]">音1</span>
                </span>
                <span className="line-clamp-1">{task.promptText}</span>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-muted px-2 py-1 text-xs">
                <StatusIcon status={task.status} />
                {statusLabel[task.status]}
              </span>
            </div>
            <div className="aspect-video bg-background">
              <div className="grid h-full place-items-center bg-[linear-gradient(135deg,hsl(220_14%_12%),hsl(220_18%_5%))]">
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
              {task.errorMessage ? <p className="rounded-md bg-danger/10 p-2 text-xs leading-5 text-danger">{task.errorMessage}</p> : null}
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
