import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AssetTable } from "./asset-table";
import { AssetsToolbar } from "./assets-toolbar";
import type { AssetFilter, AssetTab, PendingDelete, TaskFilter } from "./assets-workspace-types";
import { projectId, toFileType, toSizeLabel, toSupportedUploadMimeType } from "./asset-utils";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import { TaskDetailDrawer } from "./task-detail-drawer";
import { TaskTable } from "./task-table";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { completeAssetUpload, presignAssetUpload, uploadAssetBytes } from "@/lib/api/assets-api";
import { generationTasksKey, listGenerationTasks } from "@/lib/api/generation-api";
import { useComposerStore, type StudioAsset } from "@/lib/stores/composer-store";

export function AssetsWorkspace() {
  const [activeTab, setActiveTab] = useState<AssetTab>("assets");
  const [searchText, setSearchText] = useState("");
  const [assetFilter, setAssetFilter] = useState<AssetFilter>("all");
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("all");
  const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>();
  const [deletedTaskIds, setDeletedTaskIds] = useState<string[]>([]);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [retryFiles, setRetryFiles] = useState<Record<string, File>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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
    let previewUrl: string | undefined;
    let nextAssetId: string | null = null;
    try {
      const fileType = toFileType(file.type);
      const mimeType = toSupportedUploadMimeType(file);
      previewUrl = fileType === "image" ? URL.createObjectURL(file) : undefined;
      const presign = await presignAssetUpload({
        projectId,
        fileName: file.name,
        mimeType,
        sizeBytes: file.size,
        durationMs: null
      });
      nextAssetId = presign.assetId;
      setRetryFiles((state) => ({ ...state, [presign.assetId]: file }));
      upsertAsset({
        id: presign.assetId,
        kind: fileType,
        label: file.name.replace(/\.[^/.]+$/, "") || file.name,
        fileType,
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
      if (!nextAssetId && previewUrl) URL.revokeObjectURL(previewUrl);
      return null;
    }
  }

  function removeAssetWithPreview(assetId: string) {
    const asset = assets.find((item) => item.id === assetId);
    if (asset?.previewUrl) URL.revokeObjectURL(asset.previewUrl);
    removeAsset(assetId);
  }

  function viewAsset(asset: StudioAsset) {
    if (!asset.previewUrl) return;
    window.open(asset.previewUrl, "_blank", "noopener,noreferrer");
  }

  async function handleFiles(files: FileList | null) {
    const first = files?.item(0);
    if (!first) return;
    await uploadOne(first);
  }

  function retryAssetUpload(asset: StudioAsset) {
    const file = retryFiles[asset.id];
    if (!file) {
      fileInputRef.current?.click();
      return;
    }
    void (async () => {
      const nextId = await uploadOne(file);
      if (nextId) removeAssetWithPreview(asset.id);
    })();
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    if (pendingDelete.type === "asset") {
      removeAssetWithPreview(pendingDelete.id);
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
          aria-label="选择上传素材"
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
          <TabsContent aria-labelledby="assets-tab" id="assets-panel">
            <AssetTable
              assets={filteredAssets}
              onDelete={(asset) => setPendingDelete({ type: "asset", id: asset.id, label: asset.label, references: asset.references })}
              onRetry={retryAssetUpload}
              onView={viewAsset}
              retryFiles={retryFiles}
            />
          </TabsContent>
        ) : (
          <TabsContent aria-labelledby="tasks-tab" id="tasks-panel">
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
