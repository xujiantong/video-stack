import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock3, Copy, Film, Maximize2, PenLine, Play, RefreshCcw, ShieldAlert } from "lucide-react";
import type { GenerationTask } from "@video-stack/shared";
import { statusLabel } from "@/components/domain/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TaskHistoryStreamView } from "@/features/task-history/task-history-stream";
import { generationTasksKey, listGenerationTasks } from "@/lib/api/generation-api";

const statusTone: Record<GenerationTask["status"], "muted" | "primary" | "warning" | "danger" | "success"> = {
  draft: "muted",
  queued: "warning",
  running: "primary",
  succeeded: "success",
  failed: "danger",
  canceled: "muted"
};

function PreviewStage({ task }: { task: GenerationTask | undefined }) {
  if (!task) {
    return (
      <section className="grid min-h-[420px] place-items-center rounded-card border border-border bg-surface">
        <div className="max-w-sm text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-card border border-border bg-muted text-muted-foreground">
            <Film className="size-6" aria-hidden="true" />
          </div>
          <p className="mt-4 text-sm font-medium">暂无生成任务</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">输入提示词后生成，任务会出现在历史流中。</p>
        </div>
      </section>
    );
  }

  const parameters = task.parameters;
  const hasFailed = task.status === "failed";
  const costCents = task.actualCostCents ?? task.estimatedCostCents;

  return (
    <section className="min-h-0 rounded-card border border-border bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs uppercase text-muted-foreground">视频预览</p>
          <h2 className="mt-1 truncate text-base font-semibold">{task.promptText}</h2>
        </div>
        <Badge className="shrink-0" tone={statusTone[task.status]}>
          {statusLabel[task.status]}
        </Badge>
      </div>
      <div className="p-4">
        <div className="studio-preview-bg grid aspect-video place-items-center overflow-hidden rounded-card border border-border bg-background">
          {task.status === "succeeded" ? (
            <Button aria-label="播放生成结果" className="size-14 rounded-full px-0" type="button">
              <Play className="size-5 fill-current" aria-hidden="true" />
            </Button>
          ) : hasFailed ? (
            <div className="max-w-md px-6 text-center">
              <ShieldAlert className="mx-auto size-8 text-danger" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium text-danger">生成失败</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{task.errorMessage ? `${task.errorMessage} 请调整参数后重试。` : "生成失败，请稍后重试或查看详情。"}</p>
            </div>
          ) : (
            <div className="text-center">
              <Clock3 className="mx-auto size-8 text-primary" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium">{statusLabel[task.status]}</p>
              <p className="mt-2 text-sm text-muted-foreground">任务运行时仍可编辑下一条提示词。</p>
            </div>
          )}
        </div>
        <div className="mt-4 grid gap-3 xl:grid-cols-[1fr_220px]">
          <div className="rounded-card border border-border bg-background/50 p-3">
            <p className="text-xs uppercase text-muted-foreground">原始提示词</p>
            <p className="mt-2 text-sm leading-6">{task.promptText}</p>
            {task.assetRefs.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {task.assetRefs.map((assetRef) => (
                  <Badge key={assetRef.id}>@{assetRef.label}</Badge>
                ))}
              </div>
            ) : null}
          </div>
          <dl className="grid grid-cols-2 gap-2 rounded-card border border-border bg-background/50 p-3 text-xs">
            <div>
              <dt className="text-muted-foreground">模型</dt>
              <dd className="mt-1 font-medium">{parameters?.modelId ?? "seedance-lite"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">比例</dt>
              <dd className="mt-1 font-medium">{parameters?.aspectRatio ?? "16:9"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">分辨率</dt>
              <dd className="mt-1 font-medium">{parameters?.resolution.toUpperCase() ?? "1080P"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">时长</dt>
              <dd className="mt-1 font-medium">{parameters ? `${parameters.durationSeconds}s` : "8s"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">费用</dt>
              <dd className="mt-1 font-medium text-warning">¥{(costCents / 100).toFixed(2)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">状态</dt>
              <dd className="mt-1 font-medium">{statusLabel[task.status]}</dd>
            </div>
          </dl>
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary">
            <PenLine className="size-4" aria-hidden="true" />
            重新编辑
          </Button>
          <Button type="button" variant="secondary">
            <Copy className="size-4" aria-hidden="true" />
            复制参数
          </Button>
          <Button type="button">
            <RefreshCcw className="size-4" aria-hidden="true" />
            再次生成
          </Button>
          <Button aria-label="全屏预览" className="size-10 px-0" type="button" variant="ghost">
            <Maximize2 className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </section>
  );
}

export function WorkbenchDashboard({ projectId }: { projectId: string }) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>();
  const tasksQuery = useQuery({
    queryKey: generationTasksKey(projectId),
    queryFn: () => listGenerationTasks(projectId)
  });
  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? tasks[0];

  return (
    <div className="grid min-h-full gap-4 p-4 pb-6 lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[380px_minmax(0,1fr)]">
      <aside className="min-h-0">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase text-muted-foreground">任务历史流</p>
            <h2 className="mt-1 text-base font-semibold">按时间倒序</h2>
          </div>
          <Badge tone="primary">{tasks.length} 条</Badge>
        </div>
        <TaskHistoryStreamView
          className="pb-2"
          compact
          onTaskFocus={(task) => setSelectedTaskId(task.id)}
          projectId={projectId}
          selectedTaskId={selectedTask?.id}
        />
      </aside>
      <PreviewStage task={selectedTask} />
    </div>
  );
}
