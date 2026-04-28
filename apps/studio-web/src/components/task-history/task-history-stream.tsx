import { CheckCircle2, CircleDashed, Clock3, XCircle } from "lucide-react";
import type { GenerationTask } from "@video-stack/shared";

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
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-5 py-4">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">影栈 Studio</p>
        <h1 className="mt-2 text-xl font-semibold">任务历史</h1>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-auto p-3">
        {tasks.map((task) => (
          <article className="rounded-md border border-border bg-background/50 p-3" key={task.id}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <StatusIcon status={task.status} />
                <span className="text-sm font-medium">{statusLabel[task.status]}</span>
              </div>
              <span className="text-xs text-muted-foreground">¥{(task.estimatedCostCents / 100).toFixed(2)}</span>
            </div>
            <p className="mt-2 line-clamp-2 text-sm leading-5 text-muted-foreground">{task.promptText}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
