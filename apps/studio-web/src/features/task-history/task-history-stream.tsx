import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, CircleDashed, Clock3, MoreHorizontal, PenLine, Play, RefreshCcw, XCircle } from "lucide-react";
import type { GenerationTask } from "@video-stack/shared";
import { statusLabel } from "@/components/domain/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { generationTaskKey, generationTasksKey, getGenerationTask, listGenerationTasks } from "@/lib/api/generation-api";

const taskPollIntervalMs = 1_500;

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

function isActiveTask(status: GenerationTask["status"]): boolean {
  return status === "queued" || status === "running";
}

function hasActiveTasks(tasks: GenerationTask[] | undefined): boolean {
  return tasks?.some((task) => isActiveTask(task.status)) ?? false;
}

function TaskHistoryCard({ pollIntervalMs, task }: { pollIntervalMs: number; task: GenerationTask }) {
  const detailQuery = useQuery({
    queryKey: generationTaskKey(task.id),
    queryFn: () => getGenerationTask(task.id),
    placeholderData: task,
    enabled: isActiveTask(task.status),
    refetchInterval: (query) => (isActiveTask(query.state.data?.status ?? task.status) ? pollIntervalMs : false),
    refetchIntervalInBackground: true
  });
  const currentTask = isActiveTask(task.status) ? (detailQuery.data ?? task) : task;
  const parameters = currentTask.parameters;
  const failureMessage = currentTask.errorMessage ? `${currentTask.errorMessage} 请调整参数后重试。` : null;

  return (
    <article className="overflow-hidden rounded-card border border-border bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-3">
        <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <span className="flex -space-x-2">
            {currentTask.assetRefs.length > 0 ? (
              currentTask.assetRefs.slice(0, 2).map((assetRef) => (
                <span className="grid size-7 place-items-center rounded-button border border-border bg-muted text-[10px]" key={assetRef.id}>
                  {assetRef.kind === "audio" ? "音" : assetRef.kind === "video" ? "视" : "图"}
                </span>
              ))
            ) : (
              <span className="grid size-7 place-items-center rounded-button border border-border bg-muted text-[10px]">文</span>
            )}
          </span>
          <span className="line-clamp-1">{currentTask.promptText}</span>
        </div>
        <Badge className="shrink-0" tone={statusTone[currentTask.status]}>
          <StatusIcon status={currentTask.status} />
          {statusLabel[currentTask.status]}
        </Badge>
      </div>
      <div className="aspect-video bg-background">
        <div className="studio-preview-bg grid h-full place-items-center">
          {currentTask.status === "succeeded" ? (
            <span className="grid size-12 place-items-center rounded-full bg-primary text-primary-foreground">
              <Play className="size-5 fill-current" aria-hidden="true" />
            </span>
          ) : (
            <StatusIcon status={currentTask.status} />
          )}
        </div>
      </div>
      <div className="space-y-3 p-3">
        <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground">
          <span>{parameters?.modelId ?? "Seedance"}</span>
          <span>{parameters?.aspectRatio ?? "16:9"}</span>
          <span>{parameters?.resolution.toUpperCase() ?? "1080P"}</span>
          <span>{parameters ? `${parameters.durationSeconds}s` : "15s"}</span>
        </div>
        {failureMessage ? <p className="rounded-card bg-danger/10 p-2 text-xs leading-5 text-danger">{failureMessage}</p> : null}
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-warning">¥{(currentTask.estimatedCostCents / 100).toFixed(2)}</span>
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
  );
}

export function TaskHistoryStream({ pollIntervalMs = taskPollIntervalMs, projectId }: { pollIntervalMs?: number; projectId: string }) {
  const tasksQuery = useQuery({
    queryKey: generationTasksKey(projectId),
    queryFn: () => listGenerationTasks(projectId),
    refetchInterval: (query) => (hasActiveTasks(query.state.data) ? pollIntervalMs : false),
    refetchIntervalInBackground: true
  });
  const tasks = tasksQuery.data ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-3 p-4 pb-28">
      {tasksQuery.isError ? (
        <p className="rounded-card border border-danger/40 bg-danger/10 p-3 text-sm text-danger">读取任务列表失败，请刷新后重试。</p>
      ) : null}
      {tasksQuery.isPending ? <p className="text-sm text-muted-foreground">正在读取任务列表...</p> : null}
      <div className="grid gap-2 md:grid-cols-2">
        {tasks.map((task) => (
          <TaskHistoryCard key={task.id} pollIntervalMs={pollIntervalMs} task={task} />
        ))}
      </div>
    </div>
  );
}
