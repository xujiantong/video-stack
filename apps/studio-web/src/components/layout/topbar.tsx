import { ChevronDown, Grid2X2, List, LogIn, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useComposerStore } from "@/lib/stores/composer-store";

const filters = [
  { label: "时间筛选", options: ["今天", "本周", "全部时间"] },
  { label: "生成类型筛选", options: ["视频生成", "图片参考", "音频参考"] },
  { label: "操作类型筛选", options: ["全部操作", "生成", "上传"] }
];

export function Topbar() {
  const view = useComposerStore((state) => state.view);
  const setView = useComposerStore((state) => state.setView);
  const title =
    view === "assets"
      ? "资产与任务"
      : view === "api"
        ? "API 设置"
        : view === "login"
          ? "登录"
          : view === "settings"
            ? "系统设置"
          : view === "canvas"
            ? "画布"
            : "产品短片工作台";

  return (
    <header className="flex min-h-20 items-center justify-between gap-5 border-b border-border bg-card/80 px-6 py-3">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold">{view === "generate" ? "生成历史流" : title}</h1>
      </div>
      <div className="hidden min-w-0 flex-1 items-center justify-end gap-2 lg:flex">
        <label className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            aria-label="搜索"
            className="h-11 rounded-card bg-background/70 pl-9"
            placeholder="搜索素材、任务或提示词"
          />
        </label>
        {filters.map((filter) => (
          <label className="relative" key={filter.label}>
            <span className="sr-only">{filter.label}</span>
            <select
              aria-label={filter.label}
              className="h-11 appearance-none rounded-card border border-border bg-background/70 py-0 pl-3 pr-12 text-sm font-medium text-foreground outline-none transition hover:border-primary/70 focus:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              defaultValue={filter.options[0] ?? ""}
            >
              {filter.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          </label>
        ))}
        <div className="grid grid-cols-2 overflow-hidden rounded-card border border-border bg-background/70">
          <Button aria-label="网格视图" className="size-11 rounded-none px-0 text-primary" type="button" variant="ghost">
            <Grid2X2 className="size-4" aria-hidden="true" />
          </Button>
          <Button aria-label="列表视图" className="size-11 rounded-none px-0" type="button" variant="ghost">
            <List className="size-4" aria-hidden="true" />
          </Button>
        </div>
        <Button className="h-11" type="button" variant="secondary" onClick={() => setView("login")}>
          <LogIn className="size-4" aria-hidden="true" />
          登录
        </Button>
      </div>
    </header>
  );
}
