import { ChevronDown, Search } from "lucide-react";
import { useComposerStore } from "@/lib/stores/composer-store";

export function Topbar() {
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
