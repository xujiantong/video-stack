import { Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AssetFilter, AssetTab, TaskFilter } from "./assets-workspace-types";

export function AssetsToolbar({
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
      <TabsList aria-label="资产页面视图">
        <TabsTrigger active={activeTab === "assets"} aria-controls="assets-panel" id="assets-tab" onClick={() => onTabChange("assets")}>
          资产库
        </TabsTrigger>
        <TabsTrigger active={activeTab === "tasks"} aria-controls="tasks-panel" id="tasks-tab" onClick={() => onTabChange("tasks")}>
          任务列表
        </TabsTrigger>
      </TabsList>
      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
        <label className="relative min-w-60 max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            aria-label="搜索资产或任务"
            className="pl-9"
            value={searchText}
            onChange={(event) => onSearchTextChange(event.target.value)}
            placeholder="搜索资产或任务"
          />
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
