import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  ChevronDown,
  Copy,
  Eye,
  FileAudio2,
  Film,
  Image,
  KeyRound,
  PanelRightClose,
  PenLine,
  Search,
  Trash2,
  Upload
} from "lucide-react";
import { WorkbenchShell } from "@/components/layout/workbench-shell";
import { TaskHistoryStream } from "@/components/task-history/task-history-stream";
import { Button } from "@/components/ui/button";
import { GenerationComposer } from "@/features/generation/generation-composer";
import { cn } from "@/lib/utils";
import { useComposerStore, type StudioAsset } from "@/lib/stores/composer-store";
import type { GenerationTask } from "@video-stack/shared";

const queryClient = new QueryClient();

const statusClass: Record<GenerationTask["status"], string> = {
  draft: "border-border bg-muted text-muted-foreground",
  queued: "border-border bg-muted text-muted-foreground",
  running: "border-primary/40 bg-primary/10 text-primary",
  succeeded: "border-success/40 bg-success/10 text-success",
  failed: "border-danger/40 bg-danger/10 text-danger",
  canceled: "border-border bg-muted text-muted-foreground"
};

const statusLabel: Record<GenerationTask["status"], string> = {
  draft: "草稿",
  queued: "排队中",
  running: "生成中",
  succeeded: "已完成",
  failed: "失败",
  canceled: "已取消"
};

function Topbar() {
  const view = useComposerStore((state) => state.view);
  const title = view === "assets" ? "资产与任务" : view === "api" ? "API 设置" : view === "settings" ? "系统设置" : "产品短片工作台";

  return (
    <header className="flex min-h-16 items-center justify-between gap-4 border-b border-border bg-card px-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">影栈 Studio</p>
        <h1 className="mt-1 text-xl font-semibold">{title}</h1>
      </div>
      <div className="hidden min-w-0 flex-1 items-center justify-end gap-2 lg:flex">
        <label className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            aria-label="搜索"
            className="h-9 w-full rounded-md border border-border bg-input pl-9 pr-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary"
            placeholder="搜索素材、任务或提示词"
          />
        </label>
        {["今天", "视频生成", "全部操作"].map((label) => (
          <button
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-muted px-3 text-sm text-foreground transition hover:border-primary"
            key={label}
            type="button"
          >
            {label}
            <ChevronDown className="size-3 text-muted-foreground" aria-hidden="true" />
          </button>
        ))}
      </div>
    </header>
  );
}

function GenerateView() {
  const tasks = useComposerStore((state) => state.tasks);
  return <TaskHistoryStream tasks={tasks} />;
}

function AssetIcon({ asset }: { asset: StudioAsset }) {
  const Icon = asset.fileType === "audio" ? FileAudio2 : asset.fileType === "video" ? Film : Image;
  return (
    <span className="grid size-10 place-items-center rounded-md border border-border bg-muted text-primary">
      <Icon className="size-4" aria-hidden="true" />
    </span>
  );
}

function AssetTaskView() {
  const assets = useComposerStore((state) => state.assets);
  const tasks = useComposerStore((state) => state.tasks);
  const selectedTask = tasks[0];

  return (
    <div className="grid min-h-full grid-cols-1 gap-4 p-4 pb-28 xl:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex rounded-md border border-border bg-muted p-1">
            <button className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground" type="button">
              资产库
            </button>
            <button className="rounded-md px-3 py-1.5 text-sm text-muted-foreground" type="button">
              任务列表
            </button>
          </div>
          <Button type="button">
            <Upload className="size-4" aria-hidden="true" />
            上传素材
          </Button>
        </div>

        <section className="overflow-hidden rounded-md border border-border bg-surface">
          <div className="grid grid-cols-[64px_1.2fr_0.7fr_0.7fr_0.7fr_1fr_96px] border-b border-border px-3 py-2 text-xs text-muted-foreground">
            <span>缩略图</span>
            <span>名称</span>
            <span>类型</span>
            <span>大小</span>
            <span>引用次数</span>
            <span>创建时间</span>
            <span>操作</span>
          </div>
          {assets.map((asset) => (
            <div
              className="grid grid-cols-[64px_1.2fr_0.7fr_0.7fr_0.7fr_1fr_96px] items-center border-b border-border px-3 py-3 text-sm last:border-b-0"
              key={asset.id}
            >
              <AssetIcon asset={asset} />
              <span className="font-medium">{asset.label}</span>
              <span className="text-muted-foreground">{asset.fileType}</span>
              <span className="text-muted-foreground">{asset.sizeLabel}</span>
              <span>{asset.references}</span>
              <span className="text-muted-foreground">{asset.createdAt}</span>
              <div className="flex gap-1">
                <Button aria-label="查看资产" className="size-8 px-0" type="button" variant="ghost">
                  <Eye className="size-4" aria-hidden="true" />
                </Button>
                <Button aria-label="删除资产" className="size-8 px-0 text-danger" type="button" variant="ghost">
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          ))}
        </section>

        <section className="overflow-hidden rounded-md border border-border bg-surface">
          <div className="grid grid-cols-[1.5fr_0.8fr_0.7fr_0.6fr_0.8fr_180px] border-b border-border px-3 py-2 text-xs text-muted-foreground">
            <span>提示词摘要</span>
            <span>模型</span>
            <span>状态</span>
            <span>费用</span>
            <span>时间</span>
            <span>操作</span>
          </div>
          {tasks.map((task) => (
            <div
              className="grid grid-cols-[1.5fr_0.8fr_0.7fr_0.6fr_0.8fr_180px] items-center border-b border-border px-3 py-3 text-sm last:border-b-0"
              key={task.id}
            >
              <span className="line-clamp-1">{task.promptText}</span>
              <span className="text-muted-foreground">Seedance 2.0</span>
              <span className={cn("w-fit rounded-md border px-2 py-1 text-xs", statusClass[task.status])}>{statusLabel[task.status]}</span>
              <span className="text-warning">¥{(task.estimatedCostCents / 100).toFixed(2)}</span>
              <span className="text-muted-foreground">今天</span>
              <div className="flex gap-1">
                <Button aria-label="查看任务" className="size-8 px-0" type="button" variant="ghost">
                  <Eye className="size-4" aria-hidden="true" />
                </Button>
                <Button aria-label="重新编辑" className="size-8 px-0" type="button" variant="ghost">
                  <PenLine className="size-4" aria-hidden="true" />
                </Button>
                <Button aria-label="复制参数" className="size-8 px-0" type="button" variant="ghost">
                  <Copy className="size-4" aria-hidden="true" />
                </Button>
                <Button aria-label="删除任务" className="size-8 px-0 text-danger" type="button" variant="ghost">
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          ))}
        </section>
      </div>

      <aside className="rounded-md border border-border bg-surface p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">任务详情</h2>
          <Button aria-label="关闭详情" className="size-8 px-0" type="button" variant="ghost">
            <PanelRightClose className="size-4" aria-hidden="true" />
          </Button>
        </div>
        <div className="mt-4 aspect-video rounded-md border border-border bg-background">
          <div className="grid h-full place-items-center text-muted-foreground">
            <Film className="size-8" aria-hidden="true" />
          </div>
        </div>
        <div className="mt-4 space-y-4 text-sm">
          <section>
            <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">原始提示词</p>
            <p className="rounded-md bg-muted p-3 leading-6">{selectedTask?.promptText}</p>
          </section>
          <section>
            <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">参数快照</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {["Seedance 2.0", "全能参考", "16:9", "1080P", "15s", "¥8.60"].map((item) => (
                <span className="rounded-md border border-border bg-muted px-2 py-2" key={item}>
                  {item}
                </span>
              ))}
            </div>
          </section>
          <section>
            <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">引用资产</p>
            <div className="flex gap-2">
              {assets.map((asset) => (
                <AssetIcon asset={asset} key={asset.id} />
              ))}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}

function ApiSettingsView() {
  return (
    <div className="mx-auto max-w-3xl p-4 pb-28">
      <section className="rounded-md border border-border bg-surface p-5">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-md bg-primary/10 text-primary">
            <KeyRound className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-semibold">API 配置</h2>
            <p className="text-sm text-muted-foreground">前端不保存 Secret Key，密钥提交后由后端加密保存。</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4">
          {["API Key", "Secret Key", "服务区域", "默认模型"].map((label) => (
            <label className="grid gap-2 text-sm" key={label}>
              <span className="text-muted-foreground">{label}</span>
              <input
                className="h-10 rounded-md border border-border bg-input px-3 outline-none transition focus:border-primary"
                placeholder={`请输入${label}`}
                type={label.includes("Secret") ? "password" : "text"}
              />
            </label>
          ))}
          <Button className="w-fit" type="button">
            保存并检测连接
          </Button>
        </div>
      </section>
    </div>
  );
}

function PlaceholderView() {
  return (
    <div className="grid min-h-full place-items-center p-6 pb-28">
      <div className="max-w-md rounded-md border border-border bg-surface p-6 text-center">
        <p className="text-lg font-semibold">模块建设中</p>
        <p className="mt-2 text-sm text-muted-foreground">当前 MVP 优先完成生成、资产、任务和 API 配置。</p>
      </div>
    </div>
  );
}

function StudioContent() {
  const view = useComposerStore((state) => state.view);
  if (view === "assets") return <AssetTaskView />;
  if (view === "api") return <ApiSettingsView />;
  if (view === "settings" || view === "inspiration") return <PlaceholderView />;
  return <GenerateView />;
}

function StudioApp() {
  return <WorkbenchShell topbar={<Topbar />} content={<StudioContent />} composer={<GenerationComposer />} />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <StudioApp />
    </QueryClientProvider>
  );
}
