import { LogIn, Search } from "lucide-react";
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
        {filters.map((filter) => (
          <select
            aria-label={filter.label}
            className="h-9 rounded-button border border-border bg-muted px-3 text-sm text-foreground outline-none transition hover:border-primary/70 focus:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            defaultValue={filter.options[0] ?? ""}
            key={filter.label}
          >
            {filter.options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        ))}
        <Button className="h-9" type="button" variant="secondary" onClick={() => setView("login")}>
          <LogIn className="size-4" aria-hidden="true" />
          登录
        </Button>
      </div>
    </header>
  );
}
