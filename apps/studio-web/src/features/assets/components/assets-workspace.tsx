import { useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, Eye, Film, PanelRightClose, PenLine, Search, Trash2, Upload, X } from "lucide-react";
import type { GenerationTask } from "@video-stack/shared";
import { AssetIcon } from "@/components/domain/asset-icon";
import { StatusBadge } from "@/components/domain/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogCloseButton, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerBody, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip } from "@/components/ui/tooltip";
import { completeAssetUpload, presignAssetUpload, uploadAssetBytes } from "@/lib/api/assets-api";
import { generationTasksKey, listGenerationTasks } from "@/lib/api/generation-api";
import { cn } from "@/lib/utils";
import { useComposerStore, type StudioAsset } from "@/lib/stores/composer-store";

type AssetTab = "assets" | "tasks";
type AssetFilter = "all" | StudioAsset["fileType"];
type TaskFilter = "all" | GenerationTask["status"];
type PendingDelete =
  | { type: "asset"; id: string; label: string; references: number }
  | { type: "task"; id: string; label: string };

const projectId = "00000000-0000-4000-8000-000000000001";

function toSizeLabel(sizeBytes: number): string {
  if (sizeBytes >= 1024 * 1024) return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  if (sizeBytes >= 1024) return `${Math.round(sizeBytes / 1024)} KB`;
  return `${sizeBytes} B`;
}

function toFileType(mimeType: string): "image" | "audio" | "video" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  return "video";
}

function IconAction({ children, danger = false, label, onClick }: { children: ReactNode; danger?: boolean; label: string; onClick?(): void }) {
  return (
    <Tooltip label={label}>
      <Button aria-label={label} className={cn("size-8 px-0", danger && "text-danger")} onClick={onClick} type="button" variant="ghost">
        {children}
      </Button>
    </Tooltip>
  );
}

function AssetsToolbar({
  activeTab,
  assetFilter,
  onAssetFilterChange,
  onSearchTextChange,
  onTabChange,
  onTaskFilterChange,
  onUpload,
  searchText,
  taskFilter
}: {
  activeTab: AssetTab;
  assetFilter: AssetFilter;
  onAssetFilterChange(value: AssetFilter): void;
  onSearchTextChange(value: string): void;
  onTabChange(value: AssetTab): void;
  onTaskFilterChange(value: TaskFilter): void;
  onUpload(): void;
  searchText: string;
  taskFilter: TaskFilter;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <TabsList>
        <TabsTrigger active={activeTab === "assets"} onClick={() => onTabChange("assets")}>
          资产库
        </TabsTrigger>
        <TabsTrigger active={activeTab === "tasks"} onClick={() => onTabChange("tasks")}>
          任务列表
        </TabsTrigger>
      </TabsList>
      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
        <label className="relative min-w-60 max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input className="pl-9" value={searchText} onChange={(event) => onSearchTextChange(event.target.value)} placeholder="搜索资产或任务" />
        </label>
        {activeTab === "assets" ? (
          <select
            aria-label="筛选资产类型"
            className="h-10 rounded-button border border-border bg-input px-3 text-sm"
            value={assetFilter}
            onChange={(event) => onAssetFilterChange(event.target.value as AssetFilter)}
          >
            <option value="all">全部类型</option>
            <option value="image">图片</option>
            <option value="video">视频</option>
            <option value="audio">音频</option>
          </select>
        ) : (
          <select
            aria-label="筛选任务状态"
            className="h-10 rounded-button border border-border bg-input px-3 text-sm"
            value={taskFilter}
            onChange={(event) => onTaskFilterChange(event.target.value as TaskFilter)}
          >
            <option value="all">全部状态</option>
            <option value="queued">排队中</option>
            <option value="running">生成中</option>
            <option value="succeeded">已完成</option>
            <option value="failed">失败</option>
            <option value="canceled">已取消</option>
          </select>
        )}
        <Button onClick={onUpload} type="button">
          <Upload className="size-4" aria-hidden="true" />
          上传素材
        </Button>
      </div>
    </div>
  );
}

function AssetTable({
  assets,
  onDelete,
  onRetry,
  retryFiles
}: {
  assets: StudioAsset[];
  onDelete(asset: StudioAsset): void;
  onRetry(asset: StudioAsset): void;
  retryFiles: Record<string, File>;
}) {
  return (
    <Table className="min-w-[860px]">
      <TableHeader>
        <TableRow>
          <TableHead className="w-16">缩略图</TableHead>
          <TableHead>名称</TableHead>
          <TableHead>类型</TableHead>
          <TableHead>大小</TableHead>
          <TableHead>状态</TableHead>
          <TableHead>引用次数</TableHead>
          <TableHead>创建时间</TableHead>
          <TableHead className="w-24">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {assets.map((asset) => (
          <TableRow key={asset.id}>
            <TableCell>
              <AssetIcon asset={asset} />
            </TableCell>
            <TableCell className="font-medium">{asset.label}</TableCell>
            <TableCell className="text-muted-foreground">{asset.fileType}</TableCell>
            <TableCell className="text-muted-foreground">{asset.sizeLabel}</TableCell>
            <TableCell>
              {asset.status === "ready" ? (
                <Badge tone="success">已完成</Badge>
              ) : asset.status === "uploading" ? (
                <Badge tone="warning">上传中</Badge>
              ) : (
                <div className="flex items-center gap-2">
                  <Badge tone="danger">失败</Badge>
                  <span className="text-xs text-muted-foreground">{asset.uploadError ?? "上传失败，请重试。"}</span>
                </div>
              )}
            </TableCell>
            <TableCell>{asset.references}</TableCell>
            <TableCell className="text-muted-foreground">{asset.createdAt}</TableCell>
            <TableCell>
              <div className="flex gap-1">
                {asset.status === "failed" ? (
                  <Tooltip label={retryFiles[asset.id] ? "重试上传" : "重新选择文件"}>
                    <Button aria-label="重试上传" className="h-8 px-2" onClick={() => onRetry(asset)} type="button" variant="ghost">
                      重试
                    </Button>
                  </Tooltip>
                ) : null}
                <IconAction label="查看资产">
                  <Eye className="size-4" aria-hidden="true" />
                </IconAction>
                <IconAction danger label="删除资产" onClick={() => onDelete(asset)}>
                  <Trash2 className="size-4" aria-hidden="true" />
                </IconAction>
              </div>
            </TableCell>
          </TableRow>
        ))}
        {assets.length === 0 ? (
          <TableRow>
            <TableCell className="py-10 text-center text-muted-foreground" colSpan={8}>
              没有匹配资产，请调整搜索或筛选条件。
            </TableCell>
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  );
}

function TaskTable({
  onCopyParameters,
  onDelete,
  onEdit,
  onOpen,
  selectedTaskId,
  tasks
}: {
  onCopyParameters(task: GenerationTask): void;
  onDelete(task: GenerationTask): void;
  onEdit(task: GenerationTask): void;
  onOpen(task: GenerationTask): void;
  selectedTaskId: string | undefined;
  tasks: GenerationTask[];
}) {
  return (
    <Table className="min-w-[920px]">
      <TableHeader>
        <TableRow>
          <TableHead>提示词摘要</TableHead>
          <TableHead>模型</TableHead>
          <TableHead>状态</TableHead>
          <TableHead>费用</TableHead>
          <TableHead>时间</TableHead>
          <TableHead className="w-44">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((task) => (
          <TableRow key={task.id} className={selectedTaskId === task.id ? "bg-muted/45" : undefined}>
            <TableCell className="max-w-72">
              <span className="line-clamp-1">{task.promptText}</span>
            </TableCell>
            <TableCell className="text-muted-foreground">{task.parameters?.modelId ?? "Seedance 2.0"}</TableCell>
            <TableCell>
              <StatusBadge status={task.status} />
            </TableCell>
            <TableCell>
              <Badge tone="warning">¥{(task.estimatedCostCents / 100).toFixed(2)}</Badge>
            </TableCell>
            <TableCell className="text-muted-foreground">今天</TableCell>
            <TableCell>
              <div className="flex gap-1">
                <IconAction label="查看任务" onClick={() => onOpen(task)}>
                  <Eye className="size-4" aria-hidden="true" />
                </IconAction>
                <IconAction label="重新编辑" onClick={() => onEdit(task)}>
                  <PenLine className="size-4" aria-hidden="true" />
                </IconAction>
                <IconAction label="复制参数" onClick={() => onCopyParameters(task)}>
                  <Copy className="size-4" aria-hidden="true" />
                </IconAction>
                <IconAction danger label="删除任务" onClick={() => onDelete(task)}>
                  <Trash2 className="size-4" aria-hidden="true" />
                </IconAction>
              </div>
            </TableCell>
          </TableRow>
        ))}
        {tasks.length === 0 ? (
          <TableRow>
            <TableCell className="py-10 text-center text-muted-foreground" colSpan={6}>
              没有匹配任务，请调整搜索或筛选条件。
            </TableCell>
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  );
}

function TaskDetailDrawer({ assets, onClose, task }: { assets: StudioAsset[]; onClose(): void; task: GenerationTask | undefined }) {
  const referencedAssets = assets.filter((asset) => task?.assetRefs.some((ref) => ref.id === asset.id) ?? false);
  const costCents = (task?.actualCostCents ?? task?.estimatedCostCents) ?? 0;

  return (
    <Drawer>
      <DrawerHeader>
        <DrawerTitle>任务详情</DrawerTitle>
        <IconAction label="关闭详情" onClick={onClose}>
          {task ? <PanelRightClose className="size-4" aria-hidden="true" /> : <X className="size-4" aria-hidden="true" />}
        </IconAction>
      </DrawerHeader>
      <div className="mt-4 aspect-video rounded-card border border-border bg-background">
        <div className="grid h-full place-items-center text-muted-foreground">
          <Film className="size-8" aria-hidden="true" />
        </div>
      </div>
      <DrawerBody>
        <section>
          <p className="mb-2 text-xs uppercase text-muted-foreground">原始提示词</p>
          <p className="rounded-card bg-muted p-3 leading-6">{task?.promptText ?? "请选择一个任务查看详情。"}</p>
        </section>
        <section>
          <p className="mb-2 text-xs uppercase text-muted-foreground">参数快照</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              task?.parameters?.modelId ?? "Seedance 2.0",
              task?.parameters?.mode ?? "全能参考",
              task?.parameters?.aspectRatio ?? "16:9",
              task?.parameters?.resolution.toUpperCase() ?? "1080P",
              task?.parameters ? `${task.parameters.durationSeconds}s` : "8s",
              `¥${(costCents / 100).toFixed(2)}`
            ].map((item) => (
              <Badge className="justify-center py-2" key={item}>
                {item}
              </Badge>
            ))}
          </div>
        </section>
        <section>
          <p className="mb-2 text-xs uppercase text-muted-foreground">引用资产</p>
          <div className="flex gap-2">
            {referencedAssets.map((asset) => (
              <AssetIcon asset={asset} key={asset.id} />
            ))}
            {task && task.assetRefs.length === 0 ? <p className="text-muted-foreground">当前任务没有引用资产。</p> : null}
          </div>
        </section>
      </DrawerBody>
    </Drawer>
  );
}

function DeleteConfirmDialog({ onConfirm, onOpenChange, pendingDelete }: { onConfirm(): void; onOpenChange(open: boolean): void; pendingDelete: PendingDelete | null }) {
  return (
    <Dialog open={pendingDelete !== null} title="确认删除" onOpenChange={onOpenChange}>
      <DialogHeader>
        <div>
          <DialogTitle>确认删除</DialogTitle>
          <DialogDescription>
            {pendingDelete?.type === "asset"
              ? `删除「${pendingDelete.label}」后，引用它的任务不会再显示该素材。`
              : `删除「${pendingDelete?.label ?? ""}」后，任务列表会移除这条记录。`}
          </DialogDescription>
        </div>
        <DialogCloseButton onClose={() => onOpenChange(false)} />
      </DialogHeader>
      {pendingDelete?.type === "asset" && pendingDelete.references > 0 ? (
        <p className="rounded-card border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
          该资产被引用 {pendingDelete.references} 次，请确认后删除。
        </p>
      ) : null}
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
          取消
        </Button>
        <Button type="button" variant="danger" onClick={onConfirm}>
          删除
        </Button>
      </div>
    </Dialog>
  );
}

export function AssetsWorkspace() {
  const [activeTab, setActiveTab] = useState<AssetTab>("assets");
  const [searchText, setSearchText] = useState("");
  const [assetFilter, setAssetFilter] = useState<AssetFilter>("all");
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("all");
  const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>();
  const [deletedTaskIds, setDeletedTaskIds] = useState<string[]>([]);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const assets = useComposerStore((state) => state.assets);
  const upsertAsset = useComposerStore((state) => state.upsertAsset);
  const setAssetStatus = useComposerStore((state) => state.setAssetStatus);
  const removeAsset = useComposerStore((state) => state.removeAsset);
  const setPrompt = useComposerStore((state) => state.setPrompt);
  const setParameters = useComposerStore((state) => state.setParameters);
  const setView = useComposerStore((state) => state.setView);
  const tasksQuery = useQuery({
    queryKey: generationTasksKey(projectId),
    queryFn: () => listGenerationTasks(projectId)
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [retryFiles, setRetryFiles] = useState<Record<string, File>>({});
  const tasks = (tasksQuery.data ?? []).filter((task) => !deletedTaskIds.includes(task.id));
  const normalizedSearch = searchText.trim().toLowerCase();
  const filteredAssets = assets.filter((asset) => {
    const matchesSearch = normalizedSearch.length === 0 || asset.label.toLowerCase().includes(normalizedSearch);
    const matchesType = assetFilter === "all" || asset.fileType === assetFilter;
    return matchesSearch && matchesType;
  });
  const filteredTasks = tasks.filter((task) => {
    const matchesSearch = normalizedSearch.length === 0 || task.promptText.toLowerCase().includes(normalizedSearch);
    const matchesStatus = taskFilter === "all" || task.status === taskFilter;
    return matchesSearch && matchesStatus;
  });
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? filteredTasks[0] ?? tasks[0];

  async function uploadOne(file: File): Promise<string | null> {
    const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
    let nextAssetId: string | null = null;
    try {
      const presign = await presignAssetUpload({
        projectId,
        fileName: file.name,
        mimeType: file.type as never,
        sizeBytes: file.size,
        durationMs: null
      });
      nextAssetId = presign.assetId;
      setRetryFiles((state) => ({ ...state, [presign.assetId]: file }));
      upsertAsset({
        id: presign.assetId,
        kind: toFileType(file.type) === "audio" ? "audio" : toFileType(file.type) === "video" ? "video" : "image",
        label: file.name.replace(/\.[^/.]+$/, "") || file.name,
        fileType: toFileType(file.type),
        sizeLabel: toSizeLabel(file.size),
        references: 0,
        createdAt: "刚刚",
        status: "uploading",
        ...(previewUrl ? { previewUrl } : {})
      });
      await uploadAssetBytes(presign.uploadUrl, presign.uploadHeaders, file);
      await completeAssetUpload({ assetId: presign.assetId, projectId, storageKey: presign.storageKey });
      setAssetStatus(presign.assetId, "ready");
      return presign.assetId;
    } catch (error) {
      if (nextAssetId) setAssetStatus(nextAssetId, "failed", error instanceof Error ? error.message : "上传失败，请重试。");
      return null;
    }
  }

  async function handleFiles(files: FileList | null) {
    const first = files?.item(0);
    if (!first) return;
    await uploadOne(first);
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    if (pendingDelete.type === "asset") {
      removeAsset(pendingDelete.id);
    } else {
      setDeletedTaskIds((ids) => [...ids, pendingDelete.id]);
      if (selectedTaskId === pendingDelete.id) setSelectedTaskId(undefined);
    }
    setPendingDelete(null);
  }

  return (
    <div className="grid min-h-full grid-cols-1 gap-4 p-4 pb-28 xl:grid-cols-[1fr_360px]">
      <Tabs>
        <AssetsToolbar
          activeTab={activeTab}
          assetFilter={assetFilter}
          onAssetFilterChange={setAssetFilter}
          onSearchTextChange={setSearchText}
          onTabChange={setActiveTab}
          onTaskFilterChange={setTaskFilter}
          onUpload={() => fileInputRef.current?.click()}
          searchText={searchText}
          taskFilter={taskFilter}
        />
        <input
          accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime,audio/mpeg,audio/wav"
          className="hidden"
          onChange={(event) => {
            void handleFiles(event.target.files);
            event.target.value = "";
          }}
          ref={fileInputRef}
          type="file"
        />
        {activeTab === "assets" ? (
          <TabsContent>
            <AssetTable
              assets={filteredAssets}
              onDelete={(asset) => setPendingDelete({ type: "asset", id: asset.id, label: asset.label, references: asset.references })}
              onRetry={(asset) => {
                const file = retryFiles[asset.id];
                if (!file) {
                  fileInputRef.current?.click();
                  return;
                }
                void (async () => {
                  const nextId = await uploadOne(file);
                  if (nextId) removeAsset(asset.id);
                })();
              }}
              retryFiles={retryFiles}
            />
          </TabsContent>
        ) : (
          <TabsContent>
            <TaskTable
              onCopyParameters={(task) => {
                const parameters = task.parameters ? JSON.stringify(task.parameters, null, 2) : "当前任务没有参数快照。";
                void navigator.clipboard?.writeText(parameters);
              }}
              onDelete={(task) => setPendingDelete({ type: "task", id: task.id, label: task.promptText })}
              onEdit={(task) => {
                setPrompt(task.promptText);
                if (task.parameters) setParameters(task.parameters);
                setView("generate");
              }}
              onOpen={(task) => setSelectedTaskId(task.id)}
              selectedTaskId={selectedTask?.id}
              tasks={filteredTasks}
            />
          </TabsContent>
        )}
      </Tabs>
      <TaskDetailDrawer assets={assets} onClose={() => setSelectedTaskId(undefined)} task={selectedTask} />
      <DeleteConfirmDialog pendingDelete={pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)} onConfirm={confirmDelete} />
    </div>
  );
}
