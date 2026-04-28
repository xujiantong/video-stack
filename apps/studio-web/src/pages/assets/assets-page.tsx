import { Copy, Eye, Film, PanelRightClose, PenLine, Trash2, Upload } from "lucide-react";
import { AssetIcon } from "@/components/domain/asset-icon";
import { StatusBadge } from "@/components/domain/status-badge";
import { Button } from "@/components/ui/button";
import { useComposerStore } from "@/lib/stores/composer-store";

export function AssetsPage() {
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
              <StatusBadge status={task.status} />
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
