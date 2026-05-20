import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, Download, ImageIcon, Info, MoreHorizontal, PenLine, Play, RefreshCcw, ShieldAlert, Trash2, Waves, X } from "lucide-react";
import {
  DEFAULT_GENERATION_PARAMETERS,
  DEFAULT_MODEL_CAPABILITIES,
  isImageGenerationParameters,
  type AssetMention,
  type EstimateGenerationResponse,
  type GenerationTask
} from "@video-stack/shared";
import { statusLabel } from "@/components/domain/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogCloseButton, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { deleteGenerationTask, estimateGeneration, generationTaskKey, generationTasksKey, listGenerationTasks, regenerateGenerationTask } from "@/lib/api/generation-api";
import { useComposerStore } from "@/lib/stores/composer-store";
import { cn } from "@/lib/utils";

const statusTone: Record<GenerationTask["status"], "muted" | "primary" | "warning" | "danger" | "success"> = {
  draft: "muted",
  queued: "warning",
  running: "primary",
  succeeded: "success",
  failed: "danger",
  canceled: "muted"
};
const taskPollIntervalMs = 1_500;

function hasActiveTasks(tasks: GenerationTask[] | undefined): boolean {
  return tasks?.some((task) => task.status === "queued" || task.status === "running") ?? false;
}

function formatClock(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function referenceLabel(referenceMode: string | undefined): string {
  if (referenceMode === "image") return "图片参考";
  if (referenceMode === "first_last_frame") return "首尾帧";
  return "自动";
}

function assetLabel(asset: AssetMention): string {
  if (asset.kind === "audio") return "音频";
  if (asset.kind === "video") return "视频";
  return "图片";
}

function parametersForTask(task: GenerationTask) {
  return task.parameters ?? DEFAULT_GENERATION_PARAMETERS;
}

function isImageTask(task: GenerationTask): boolean {
  return isImageGenerationParameters(parametersForTask(task));
}

function PromptWithRefs({ compact = false, task }: { compact?: boolean; task: GenerationTask }) {
  return (
    <div className={cn("min-w-0 font-medium leading-6 text-foreground", compact ? "text-sm" : "text-lg")}>
      {task.assetRefs.map((assetRef) => (
        <Badge className="mr-1" key={assetRef.id} tone="primary">
          @{assetLabel(assetRef)}{task.assetRefs.indexOf(assetRef) + 1}
        </Badge>
      ))}
      <span>{task.promptText}</span>
    </div>
  );
}

function modelLabel(modelId: string): string {
  const model = DEFAULT_MODEL_CAPABILITIES.find((item) => item.id === modelId);
  if (model) return model.displayName;
  return modelId.replace("jimeng-video-v3", "即梦AI-视频生成3.0");
}

function TaskMeta({ onDetailsClick, task }: { onDetailsClick(): void; task: GenerationTask }) {
  const parameters = parametersForTask(task);
  const imageTask = isImageTask(task);
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span>{modelLabel(parameters.modelId)}</span>
      {imageTask ? null : (
        <>
          <span className="text-border">|</span>
          <span>{parameters.durationSeconds}s</span>
        </>
      )}
      <span className="text-border">|</span>
      <button className="inline-flex items-center gap-1.5 hover:text-foreground" onClick={onDetailsClick} type="button">
        详细信息
        <Info className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function ProgressBar({ task }: { task: GenerationTask }) {
  if (task.status !== "queued" && task.status !== "running") return null;
  const isQueued = task.status === "queued";
  return (
    <div className="mt-4 grid gap-2">
      <div className={cn("h-1.5 overflow-hidden rounded-full bg-muted", isQueued ? "opacity-70" : "studio-active-progress")}>
        {isQueued ? <span className="block h-full w-1/3 rounded-full bg-warning/70" /> : null}
      </div>
      <p className="text-right text-sm text-muted-foreground">{isQueued ? "排队等待中" : "正在生成"}</p>
    </div>
  );
}

function taskStatusLabel(status: GenerationTask["status"]): string {
  if (status === "queued") return "排队等待";
  if (status === "running") return "正在生成";
  if (status === "failed") return "生成失败";
  return statusLabel[status];
}

function DetailsPopover({ task }: { task: GenerationTask }) {
  const parameters = parametersForTask(task);
  const imageTask = isImageTask(task);
  return (
    <div className="absolute right-0 top-10 z-20 w-80 rounded-card border border-border bg-surface-raised p-5 text-sm shadow-popover">
      <dl className="grid grid-cols-[1fr_auto] gap-x-8 gap-y-4">
        <dt className="text-muted-foreground">{imageTask ? "图片比例" : "视频比例"}</dt>
        <dd>{parameters.aspectRatio}</dd>
        {imageTask ? null : (
          <>
            <dt className="text-muted-foreground">帧率</dt>
            <dd>24</dd>
            <dt className="text-muted-foreground">分辨率</dt>
            <dd>{parameters.resolution.toUpperCase()}</dd>
          </>
        )}
        <dt className="text-muted-foreground">生成时间</dt>
        <dd>{new Intl.DateTimeFormat("zh-CN", { dateStyle: "short", timeStyle: "short" }).format(new Date(task.createdAt))}</dd>
        <dt className="text-muted-foreground">参考模式</dt>
        <dd>{referenceLabel(parameters.referenceMode)}</dd>
      </dl>
    </div>
  );
}

function resultUrlForTask(task: GenerationTask): string | null {
  if (!task.resultAssetId) return null;
  return isImageTask(task) ? `/api/assets/${task.resultAssetId}/content` : `/api/assets/${task.resultAssetId}/content#t=0.1`;
}

function ResultPreview({
  menuOpen,
  onDelete,
  onMenuToggle,
  onOpenViewer,
  task
}: {
  menuOpen: boolean;
  onDelete(): void;
  onMenuToggle(): void;
  onOpenViewer(): void;
  task: GenerationTask;
}) {
  const resultUrl = resultUrlForTask(task);

  if (task.status === "succeeded" && resultUrl) {
    if (isImageTask(task)) {
      return (
        <div className="studio-preview-bg relative aspect-video max-h-[300px] cursor-zoom-in overflow-hidden bg-background">
          <img aria-label="生成图片预览" className="absolute inset-0 h-full w-full object-cover" src={resultUrl} />
          <span className="absolute left-3 top-3 rounded-button border border-white/20 bg-black/40 px-2 py-0.5 text-xs font-medium text-white/80 backdrop-blur">AI生成</span>
          <button aria-label="放大查看生成图片" className="absolute inset-0 z-10" onClick={onOpenViewer} type="button" />
          <div className="absolute right-3 top-3 z-20 flex items-center rounded-button bg-background/80 p-0.5 text-foreground shadow-popover backdrop-blur">
            <Button aria-label="下载结果" className="size-5 px-0" onClick={(event) => event.stopPropagation()} type="button" variant="ghost">
              <Download className="size-3" aria-hidden="true" />
            </Button>
            <div className="relative">
              <Button
                aria-expanded={menuOpen}
                aria-label="更多操作"
                className="size-5 px-0"
                onClick={(event) => {
                  event.stopPropagation();
                  onMenuToggle();
                }}
                type="button"
                variant="ghost"
              >
                <MoreHorizontal className="size-3" aria-hidden="true" />
              </Button>
              {menuOpen ? <TaskMenu onDelete={onDelete} /> : null}
            </div>
            <Button aria-label="收藏" className="size-5 px-0" onClick={(event) => event.stopPropagation()} type="button" variant="ghost">
              <Bookmark className="size-3" aria-hidden="true" />
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="studio-preview-bg relative aspect-video max-h-[300px] cursor-zoom-in overflow-hidden bg-background">
        <video
          aria-label="生成结果预览"
          className="absolute inset-0 h-full w-full bg-black object-cover"
          muted
          playsInline
          preload="metadata"
          src={resultUrl}
        />
        <span className="absolute left-3 top-3 rounded-button border border-white/20 bg-black/40 px-2 py-0.5 text-xs font-medium text-white/80 backdrop-blur">AI生成</span>
        <button aria-label="放大查看生成结果" className="absolute inset-0 z-10 grid place-items-center" onClick={onOpenViewer} type="button">
          <span className="grid size-16 place-items-center rounded-full bg-background/65 text-foreground backdrop-blur transition">
            <Play className="ml-1 size-7 fill-current" aria-hidden="true" />
          </span>
        </button>
        <div className="absolute right-3 top-3 z-20 flex items-center rounded-button bg-background/80 p-0.5 text-foreground shadow-popover backdrop-blur">
          <Button aria-label="下载结果" className="size-5 px-0" onClick={(event) => event.stopPropagation()} type="button" variant="ghost">
            <Download className="size-3" aria-hidden="true" />
          </Button>
          <div className="relative">
            <Button
              aria-expanded={menuOpen}
              aria-label="更多操作"
              className="size-5 px-0"
              onClick={(event) => {
                event.stopPropagation();
                onMenuToggle();
              }}
              type="button"
              variant="ghost"
            >
              <MoreHorizontal className="size-3" aria-hidden="true" />
            </Button>
            {menuOpen ? <TaskMenu onDelete={onDelete} /> : null}
          </div>
          <Button aria-label="收藏" className="size-5 px-0" onClick={(event) => event.stopPropagation()} type="button" variant="ghost">
            <Bookmark className="size-3" aria-hidden="true" />
          </Button>
        </div>
        <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-between bg-gradient-to-t from-black/65 to-transparent px-5 pb-4 pt-12 text-white">
          <span className="font-mono text-sm">00:00 / 00:{(task.parameters ?? DEFAULT_GENERATION_PARAMETERS).durationSeconds.toString().padStart(2, "0")}</span>
        </div>
      </div>
    );
  }
  if (task.status === "failed") {
    return (
      <div className="mt-3 rounded-card border border-danger/30 bg-danger/10 p-4 text-sm leading-6 text-danger" role="alert">
        <ShieldAlert className="mr-2 inline size-4" aria-hidden="true" />
        {task.errorMessage ? `${task.errorMessage} 请调整参数后重试。` : "生成失败，请稍后重试或查看详情。"}
      </div>
    );
  }
  return null;
}

function VideoViewer({
  onClose,
  onDelete,
  onEdit,
  onRegenerate,
  task
}: {
  onClose(): void;
  onDelete(): void;
  onEdit(): void;
  onRegenerate(): void;
  task: GenerationTask;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const resultUrl = resultUrlForTask(task);
  const parameters = parametersForTask(task);
  const imageTask = isImageTask(task);
  if (!resultUrl) return null;

  return (
    <div className="fixed inset-0 z-50 grid grid-cols-[minmax(0,1fr)_360px] bg-background text-foreground" role="dialog" aria-label={imageTask ? "图片查看器" : "视频查看器"} aria-modal="true">
      <main className="grid min-h-0 place-items-center p-8">
        <Button aria-label="关闭查看器" className="absolute right-[384px] top-6 size-10 px-0" onClick={onClose} type="button" variant="secondary">
          <X className="size-5" aria-hidden="true" />
        </Button>
        <div className="relative w-full max-w-6xl overflow-hidden rounded-card bg-black shadow-popover">
          {imageTask ? (
            <img aria-label="放大生成图片预览" className="max-h-[78vh] w-full object-contain" src={resultUrl} />
          ) : (
            <video aria-label="放大生成结果预览" autoPlay className="max-h-[78vh] w-full object-contain" controls muted playsInline src={resultUrl} />
          )}
          <span className="absolute left-4 top-4 rounded-button border border-white/20 bg-black/40 px-2 py-1 text-sm font-medium text-white/80 backdrop-blur">AI生成</span>
        </div>
      </main>
      <aside className="border-l border-border bg-card/95 p-6">
        <div className="flex items-center justify-between gap-3">
          <Button className="h-10 px-4" type="button" variant="secondary">
            <Download className="size-4" aria-hidden="true" />
            下载
          </Button>
          <div className="relative flex items-center gap-2">
            <Button aria-label="收藏" className="size-10 px-0" type="button" variant="ghost">
              <Bookmark className="size-4" aria-hidden="true" />
            </Button>
            <Button
              aria-expanded={menuOpen}
              aria-label="更多操作"
              className="size-10 px-0"
              onClick={() => setMenuOpen((open) => !open)}
              type="button"
              variant="ghost"
            >
              <MoreHorizontal className="size-4" aria-hidden="true" />
            </Button>
            {menuOpen ? <TaskMenu onDelete={onDelete} /> : null}
          </div>
        </div>
        <div className="mt-6 border-t border-border pt-6">
          <p className="text-sm text-muted-foreground">{imageTask ? "图片提示词" : "视频提示词"}</p>
          <p className="mt-3 text-sm leading-6">{task.promptText}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{modelLabel(parameters.modelId)}</span>
            {imageTask ? null : (
              <>
                <span>|</span>
                <span>{parameters.durationSeconds}s</span>
              </>
            )}
            <span>|</span>
            <span>{parameters.aspectRatio}</span>
          </div>
        </div>
        <dl className="mt-8 grid grid-cols-[1fr_auto] gap-y-4 text-sm">
          {imageTask ? null : (
            <>
              <dt className="text-muted-foreground">分辨率</dt>
              <dd>{parameters.resolution.toUpperCase()}</dd>
            </>
          )}
          <dt className="text-muted-foreground">参考模式</dt>
          <dd>{referenceLabel(parameters.referenceMode)}</dd>
          <dt className="text-muted-foreground">生成时间</dt>
          <dd>{new Intl.DateTimeFormat("zh-CN", { dateStyle: "short", timeStyle: "short" }).format(new Date(task.createdAt))}</dd>
        </dl>
        <div className="absolute bottom-6 right-6 grid w-[312px] grid-cols-2 gap-3">
          <Button type="button" variant="secondary" onClick={onEdit}>
            <PenLine className="size-4" aria-hidden="true" />
            重新编辑
          </Button>
          <Button type="button" variant="secondary" onClick={onRegenerate}>
            <RefreshCcw className="size-4" aria-hidden="true" />
            再次生成
          </Button>
        </div>
      </aside>
    </div>
  );
}

function TaskMenu({ onDelete }: { onDelete(): void }) {
  return (
    <div className="absolute left-1/2 top-12 z-30 w-44 -translate-x-1/2 rounded-card border border-border bg-surface-raised p-2 shadow-popover">
      <button className="flex h-10 w-full items-center gap-2 rounded-button px-3 text-left text-sm text-danger hover:bg-danger/10" onClick={onDelete} type="button">
        <Trash2 className="size-4" aria-hidden="true" />
        删除
      </button>
    </div>
  );
}

function HistoryTaskCard({
  onEdit,
  onDelete,
  onFocus,
  onRegenerate,
  selected,
  task
}: {
  onEdit(task: GenerationTask): void;
  onDelete(task: GenerationTask): void;
  onFocus(task: GenerationTask): void;
  onRegenerate(task: GenerationTask): void;
  selected: boolean;
  task: GenerationTask;
}) {
  const isSucceeded = task.status === "succeeded";
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [mediaMenuOpen, setMediaMenuOpen] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const closeSecondaryMenus = () => {
    setDetailsOpen(false);
    setMediaMenuOpen(false);
    setActionMenuOpen(false);
  };

  return (
    <article
      className={cn(
        "flex w-full max-w-[720px] gap-3 transition",
        selected && "text-foreground"
      )}
      onClick={() => {
        closeSecondaryMenus();
        onFocus(task);
      }}
    >
      <div className="mt-1 grid size-8 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary">AI</div>
      <div className="min-w-0 flex-1">
        <div className="rounded-card bg-surface px-4 py-3 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <PromptWithRefs compact task={task} />
            <Badge className="shrink-0" tone={statusTone[task.status]}>{taskStatusLabel(task.status)}</Badge>
          </div>
          <div className="relative mt-2 inline-flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
            <TaskMeta
              onDetailsClick={() => {
                setMediaMenuOpen(false);
                setActionMenuOpen(false);
                setDetailsOpen((open) => !open);
              }}
              task={task}
            />
            {detailsOpen ? <DetailsPopover task={task} /> : null}
          </div>
          <ResultPreview
            menuOpen={mediaMenuOpen}
            onDelete={() => onDelete(task)}
            onMenuToggle={() => {
              setDetailsOpen(false);
              setActionMenuOpen(false);
              setMediaMenuOpen((open) => !open);
            }}
            onOpenViewer={() => {
              closeSecondaryMenus();
              setViewerOpen(true);
            }}
            task={task}
          />
          <ProgressBar task={task} />
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <Button className="h-9 px-3 text-xs" type="button" variant="secondary" onClick={() => onEdit(task)}>
              <PenLine className="size-4" aria-hidden="true" />
              重新编辑
            </Button>
            <Button className="h-9 px-3 text-xs" type="button" variant="secondary" onClick={() => onRegenerate(task)}>
              <RefreshCcw className="size-4" aria-hidden="true" />
              再次生成
            </Button>
            <Button
              aria-expanded={actionMenuOpen}
              aria-label="更多操作"
              className="size-9 px-0"
              onClick={(event) => {
                event.stopPropagation();
                setDetailsOpen(false);
                setMediaMenuOpen(false);
                setActionMenuOpen((open) => !open);
              }}
              type="button"
              variant="secondary"
            >
              <MoreHorizontal className="size-4" aria-hidden="true" />
            </Button>
            {actionMenuOpen ? (
              <Button className="h-9 px-4 text-xs text-danger" onClick={() => onDelete(task)} type="button" variant="secondary">
                <Trash2 className="size-4" aria-hidden="true" />
                删除
              </Button>
            ) : null}
            {!isSucceeded ? null : (
              <Button aria-label="收藏" className="size-9 px-0" type="button" variant="ghost">
                <Bookmark className="size-4" aria-hidden="true" />
              </Button>
            )}
          </div>
          <span className="whitespace-nowrap text-xs text-muted-foreground">今天 {formatClock(task.createdAt)}</span>
        </div>
      </div>
      {viewerOpen ? (
        <VideoViewer
          onClose={() => setViewerOpen(false)}
          onDelete={() => onDelete(task)}
          onEdit={() => onEdit(task)}
          onRegenerate={() => onRegenerate(task)}
          task={task}
        />
      ) : null}
    </article>
  );
}

function EmptyHistory() {
  return (
    <div className="grid min-h-[360px] place-items-center rounded-card border border-border bg-surface p-6 text-center">
      <div>
        <div className="mx-auto grid size-14 place-items-center rounded-card border border-border bg-muted text-primary">
          <Waves className="size-6" aria-hidden="true" />
        </div>
        <p className="mt-4 text-sm font-medium">暂无生成任务</p>
        <p className="mt-2 text-sm text-muted-foreground">输入提示词后生成，任务会出现在历史流中。</p>
      </div>
    </div>
  );
}

export function WorkbenchDashboard({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>();
  const [confirmRegenerate, setConfirmRegenerate] = useState<{ estimate: EstimateGenerationResponse; task: GenerationTask } | null>(null);
  const setPrompt = useComposerStore((state) => state.setPrompt);
  const setParameters = useComposerStore((state) => state.setParameters);
  const tasksQuery = useQuery({
    queryKey: generationTasksKey(projectId),
    queryFn: () => listGenerationTasks(projectId),
    refetchInterval: (query) => (hasActiveTasks(query.state.data) ? taskPollIntervalMs : false),
    refetchIntervalInBackground: true
  });
  const tasks = tasksQuery.data ?? [];
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? tasks[0];
  const regenerateMutation = useMutation({
    mutationFn: async ({ estimate, task }: { estimate: EstimateGenerationResponse; task: GenerationTask }) =>
      regenerateGenerationTask(task.id, {
        projectId,
        provider: task.provider,
        credentialId: "00000000-0000-4000-8000-000000000401",
        promptDoc: task.promptDoc,
        promptText: task.promptText,
        parameters: task.parameters ?? DEFAULT_GENERATION_PARAMETERS,
        assetRefs: task.assetRefs,
        secondConfirmToken: estimate.secondConfirmToken,
        fallbackEstimate: { estimatedCostCents: estimate.estimatedCostCents, requiresSecondConfirm: true }
      }),
    onSuccess(task) {
      queryClient.setQueryData<GenerationTask[]>(generationTasksKey(projectId), (rows) => [...(rows?.filter((row) => row.id !== task.id) ?? []), task]);
      queryClient.setQueryData(generationTaskKey(task.id), task);
      setSelectedTaskId(task.id);
      setConfirmRegenerate(null);
    }
  });
  const estimateMutation = useMutation({
    mutationFn: (task: GenerationTask) =>
      estimateGeneration({
        projectId,
        promptText: task.promptText,
        assetRefs: task.assetRefs,
        parameters: task.parameters ?? DEFAULT_GENERATION_PARAMETERS,
        sourceTaskId: task.id
      }),
    onSuccess(estimate, task) {
      setConfirmRegenerate({ estimate, task });
    }
  });
  const deleteMutation = useMutation({
    mutationFn: deleteGenerationTask,
    onSuccess(deletedTask) {
      queryClient.setQueryData<GenerationTask[]>(generationTasksKey(projectId), (rows) => rows?.filter((row) => row.id !== deletedTask.id) ?? []);
      queryClient.removeQueries({ queryKey: generationTaskKey(deletedTask.id) });
      setSelectedTaskId((current) => (current === deletedTask.id ? undefined : current));
    }
  });

  function editTask(task: GenerationTask) {
    setPrompt(task.promptText);
    if (task.parameters) setParameters(task.parameters);
  }

  function confirmAgain() {
    if (!confirmRegenerate?.estimate.secondConfirmToken) return;
    regenerateMutation.mutate(confirmRegenerate);
  }

  function deleteTask(task: GenerationTask) {
    if (!window.confirm("确定删除这个任务吗？")) return;
    deleteMutation.mutate(task.id);
  }

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-4 py-6 pb-8">
      {tasksQuery.isError ? (
        <p className="rounded-card border border-danger/40 bg-danger/10 p-3 text-sm text-danger" role="alert">
          读取任务列表失败，请刷新后重试。
        </p>
      ) : null}
      {tasksQuery.isPending ? <p className="text-sm text-muted-foreground">正在读取任务列表...</p> : null}
      {!tasksQuery.isPending && !tasksQuery.isError && tasks.length === 0 ? <EmptyHistory /> : null}
      {tasks.map((task) => (
        <HistoryTaskCard
          key={task.id}
          onEdit={editTask}
          onDelete={deleteTask}
          onFocus={(nextTask) => setSelectedTaskId(nextTask.id)}
          onRegenerate={(nextTask) => estimateMutation.mutate(nextTask)}
          selected={selectedTask?.id === task.id}
          task={task}
        />
      ))}
      <Dialog open={confirmRegenerate !== null} title="确认再次生成" onOpenChange={(open) => !open && setConfirmRegenerate(null)}>
        <DialogHeader>
          <div>
            <DialogTitle>确认再次生成</DialogTitle>
            <DialogDescription>本次预计 ¥{((confirmRegenerate?.estimate.estimatedCostCents ?? 0) / 100).toFixed(2)}。确认后再次生成任务。</DialogDescription>
          </div>
          <DialogCloseButton onClose={() => setConfirmRegenerate(null)} />
        </DialogHeader>
        <div className="rounded-card border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
          系统会复用原提示词、参数和引用素材。
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setConfirmRegenerate(null)}>
            取消
          </Button>
          <Button type="button" onClick={confirmAgain} disabled={!confirmRegenerate?.estimate.secondConfirmToken || regenerateMutation.isPending}>
            确认再次生成
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
