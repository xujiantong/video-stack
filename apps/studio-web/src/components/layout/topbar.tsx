import { ChevronDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useComposerStore } from "@/lib/stores/composer-store";

const filterLabels = ["今天", "视频生成", "全部操作"];

export function Topbar() {
  const view = useComposerStore((state) => state.view);
  const title =
    view === "assets"
      ? "资产与任务"
      : view === "api"
        ? "API 设置"
        : view === "settings"
          ? "系统设置"
          : view === "canvas"
            ? "画布"
            : "产品短片工作台";

  return (
    <header className="flex min-h-16 items-center justify-between gap-4 border-b border-border bg-card px-4 py-3">
      <div className="min-w-0">
        <p className="text-xs uppercase text-muted-foreground">影栈 Studio</p>
        <h1 className="mt-1 truncate text-xl font-semibold">{title}</h1>
      </div>
      <div className="hidden min-w-0 flex-1 items-center justify-end gap-2 lg:flex">
        <label className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            aria-label="搜索"
            className="h-9 pl-9"
            placeholder="搜索素材、任务或提示词"
          />
        </label>
        {filterLabels.map((label) => (
          <Button
            className="h-9"
            key={label}
            type="button"
            variant="secondary"
          >
            {label}
            <ChevronDown className="size-3 text-muted-foreground" aria-hidden="true" />
          </Button>
        ))}
      </div>
    </header>
  );
}
