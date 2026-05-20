import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleDashed, Clock3, ImageIcon, PenLine, Play, RefreshCcw, Trash2, XCircle } from "lucide-react";
import { DEFAULT_GENERATION_PARAMETERS, isImageGenerationParameters, type Asset, type GenerationTask } from "@video-stack/shared";
import { statusLabel } from "@/components/domain/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { assetsKey, listAssets } from "@/lib/api/assets-api";
import { deleteGenerationTask, generationTaskKey, generationTasksKey, getGenerationTask, listGenerationTasks } from "@/lib/api/generation-api";
import { useComposerStore, type StudioAsset } from "@/lib/stores/composer-store";
import { cn } from "@/lib/utils";

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

function isImageTask(task: GenerationTask): boolean {
  return isImageGenerationParameters(task.parameters ?? DEFAULT_GENERATION_PARAMETERS);
}

function TaskHistoryCard({
  compact = false,
  onEdit,
  onFocus,
  onRegenerate,
  pollIntervalMs,
  selected = false,
  task
}: {
  compact?: boolean;
  onEdit?: ((task: GenerationTask) => void) | undefined;
  onFocus?: ((task: GenerationTask) => void) | undefined;
  onRegenerate?: ((task: GenerationTask) => void) | undefined;
  pollIntervalMs: number;
  selected?: boolean;
  task: GenerationTask;
}) {
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const upsertAsset = useComposerStore((state) => state.upsertAsset);
  const deleteMutation = useMutation({
    mutationFn: deleteGenerationTask,
    onSuccess(deletedTask) {
      queryClient.setQueryData<GenerationTask[]>(generationTasksKey(deletedTask.projectId), (rows) => rows?.filter((row) => row.id !== deletedTask.id) ?? []);
      queryClient.removeQueries({ queryKey: generationTaskKey(deletedTask.id) });
    }
  });
  const detailQuery = useQuery({
    queryKey: generationTaskKey(task.id),
    queryFn: () => getGenerationTask(task.id),
    placeholderData: task,
    enabled: isActiveTask(task.status),
    refetchInterval: (query) => (isActiveTask(query.state.data?.status ?? task.status) ? pollIntervalMs : false),
    refetchIntervalInBackground: true
  });
  const currentTask = isActiveTask(task.status) ? (detailQuery.data ?? task) : task;
  useEffect(() => {
    if (isActiveTask(currentTask.status)) return;
    queryClient.setQueryData<GenerationTask[]>(generationTasksKey(task.projectId), (rows) => rows?.map((row) => (row.id === currentTask.id ? currentTask : row)) ?? rows);
    if (!currentTask.resultAssetId) return;
    void queryClient.invalidateQueries({ queryKey: assetsKey(task.projectId) });
    void listAssets(task.projectId).then((assets) => {
      for (const asset of assets) {
        upsertAsset(toStudioAsset(asset));
      }
    });
  }, [currentTask, queryClient, task.projectId, upsertAsset]);
  const parameters = currentTask.parameters;
  const failureMessage =
    currentTask.status === "failed" ? (currentTask.errorMessage ? `${currentTask.errorMessage} 请调整参数后重试。` : "生成失败，请稍后重试或查看详情。") : null;
  const imageTask = isImageTask(currentTask);
  const resultPreviewUrl = currentTask.resultAssetId
    ? imageTask
      ? `/api/assets/${currentTask.resultAssetId}/content`
      : `/api/assets/${currentTask.resultAssetId}/content#t=0.1`
    : null;
  const canPlayPreview = currentTask.status === "succeeded" && Boolean(resultPreviewUrl);

  async function handlePreviewClick() {
    if (!canPlayPreview) {
      onFocus?.(currentTask);
      return;
    }
    if (imageTask) return;
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      await video.play();
      return;
    }
    video.pause();
  }

  function handleDelete() {
    if (!window.confirm("确定删除这个任务吗？")) return;
    deleteMutation.mutate(currentTask.id);
  }

  return (
    <article
      className={cn(
        "overflow-hidden rounded-card border bg-surface transition",
        selected ? "border-primary/60 shadow-primary-ring" : "border-border hover:border-primary/30"
      )}
    >
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
      <button
        aria-label={canPlayPreview ? `${isPlaying ? "暂停" : "播放"}生成结果：${currentTask.promptText}` : `查看任务：${currentTask.promptText}`}
        className="block w-full bg-background text-left"
        onClick={() => void handlePreviewClick()}
        type="button"
      >
        <div className={cn("studio-preview-bg relative grid overflow-hidden place-items-center", compact ? "h-28" : "aspect-video")}>
          {currentTask.status === "succeeded" && resultPreviewUrl ? (
            imageTask ? (
              <>
                <img aria-label="生成图片预览" className="absolute inset-0 h-full w-full object-cover" src={resultPreviewUrl} />
                <span className="relative z-10 grid size-12 place-items-center rounded-full bg-background/70 text-foreground shadow-primary-ring backdrop-blur">
                  <ImageIcon className="size-5" aria-hidden="true" />
                </span>
              </>
            ) : (
              <>
                <video
                  ref={videoRef}
                  aria-label="生成结果预览"
                  className="absolute inset-0 h-full w-full bg-black object-cover"
                  muted
                  onEnded={() => setIsPlaying(false)}
                  onPause={() => setIsPlaying(false)}
                  onPlay={() => setIsPlaying(true)}
                  playsInline
                  preload="metadata"
                  src={resultPreviewUrl}
                />
                <span className={cn("relative z-10 grid size-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-primary-ring", isPlaying && "opacity-0")}>
                  <Play className="size-5 fill-current" aria-hidden="true" />
                </span>
              </>
            )
          ) : currentTask.status === "succeeded" ? (
            <span className="relative z-10 grid size-12 place-items-center rounded-full bg-primary text-primary-foreground">
              <Play className="size-5 fill-current" aria-hidden="true" />
            </span>
          ) : (
            <StatusIcon status={currentTask.status} />
          )}
        </div>
      </button>
      <div className="space-y-3 p-3">
        <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground">
          <span>{parameters?.modelId ?? "Seedance"}</span>
          <span>{parameters?.aspectRatio ?? "16:9"}</span>
          <span>{parameters?.resolution.toUpperCase() ?? "1080P"}</span>
          <span>{parameters ? `${parameters.durationSeconds}s` : "15s"}</span>
        </div>
        {failureMessage ? (
          <p className="rounded-card border border-danger/30 bg-danger/10 p-2 text-xs leading-5 text-danger" role="alert">
            {failureMessage}
          </p>
        ) : null}
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-warning">¥{(currentTask.estimatedCostCents / 100).toFixed(2)}</span>
          <div className="flex gap-2">
            <Button className="h-8 px-2 text-xs" onClick={() => onEdit?.(currentTask)} type="button" variant="secondary">
              <PenLine className="size-3" aria-hidden="true" />
              重新编辑
            </Button>
            <Button className="h-8 px-2 text-xs" onClick={() => onRegenerate?.(currentTask)} type="button" variant="secondary">
              <RefreshCcw className="size-3" aria-hidden="true" />
              再次生成
            </Button>
            <Button aria-label="删除任务" className="size-8 px-0 text-danger" disabled={deleteMutation.isPending} onClick={handleDelete} type="button" variant="ghost">
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

function toStudioAsset(asset: Asset): StudioAsset {
  return {
    id: asset.id,
    kind: asset.kind,
    label: asset.name.replace(/\.[^/.]+$/, "") || asset.name,
    fileType: asset.kind,
    sizeLabel: toSizeLabel(asset.sizeBytes),
    references: 0,
    createdAt: "刚刚",
    status: asset.status === "ready" || asset.status === "uploading" ? asset.status : "failed",
    ...(asset.status === "ready" ? { previewUrl: `/api/assets/${asset.id}/content` } : {})
  };
}

function toSizeLabel(sizeBytes: number): string {
  if (sizeBytes >= 1024 * 1024) return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  if (sizeBytes >= 1024) return `${Math.round(sizeBytes / 1024)} KB`;
  return `${sizeBytes} B`;
}

export function TaskHistoryStream({ pollIntervalMs = taskPollIntervalMs, projectId }: { pollIntervalMs?: number; projectId: string }) {
  return <TaskHistoryStreamView pollIntervalMs={pollIntervalMs} projectId={projectId} />;
}

export function TaskHistoryStreamView({
  className,
  compact = false,
  onTaskEdit,
  onTaskFocus,
  onTaskRegenerate,
  pollIntervalMs = taskPollIntervalMs,
  projectId,
  selectedTaskId
}: {
  className?: string;
  compact?: boolean;
  onTaskEdit?: ((task: GenerationTask) => void) | undefined;
  onTaskFocus?: ((task: GenerationTask) => void) | undefined;
  onTaskRegenerate?: ((task: GenerationTask) => void) | undefined;
  pollIntervalMs?: number;
  projectId: string;
  selectedTaskId?: string | undefined;
}) {
  const tasksQuery = useQuery({
    queryKey: generationTasksKey(projectId),
    queryFn: () => listGenerationTasks(projectId),
    refetchInterval: (query) => (hasActiveTasks(query.state.data) ? pollIntervalMs : false),
    refetchIntervalInBackground: true
  });
  const tasks = tasksQuery.data ?? [];

  return (
    <div className={cn("space-y-3", className ?? "mx-auto max-w-6xl p-4 pb-28")}>
      {tasksQuery.isError ? (
        <p className="rounded-card border border-danger/40 bg-danger/10 p-3 text-sm text-danger" role="alert">
          读取任务列表失败，请刷新后重试。
        </p>
      ) : null}
      {tasksQuery.isPending ? (
        <p className="text-sm text-muted-foreground" role="status">
          正在读取任务列表...
        </p>
      ) : null}
      {!tasksQuery.isPending && !tasksQuery.isError && tasks.length === 0 ? (
        <div className="rounded-card border border-border bg-surface p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">暂无任务</p>
          <p className="mt-1">生成任务后，历史流会显示状态、费用和下一步操作。</p>
        </div>
      ) : null}
      <div className={cn("grid gap-2", compact ? "grid-cols-1" : "md:grid-cols-2")}>
        {tasks.map((task) => (
          <TaskHistoryCard
            compact={compact}
            key={task.id}
            onEdit={onTaskEdit}
            onFocus={onTaskFocus}
            onRegenerate={onTaskRegenerate}
            pollIntervalMs={pollIntervalMs}
            selected={selectedTaskId === task.id}
            task={task}
          />
        ))}
      </div>
    </div>
  );
}
