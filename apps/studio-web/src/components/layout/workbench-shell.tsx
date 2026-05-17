import type { ReactNode } from "react";
import { Bot, Boxes, Compass, KeyRound, Settings, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useComposerStore, type StudioView } from "@/lib/stores/composer-store";

const navItems: Array<{ id: StudioView; label: string; icon: LucideIcon }> = [
  { id: "generate", label: "生成", icon: Bot },
  { id: "assets", label: "资产", icon: Boxes },
  { id: "settings", label: "设置", icon: Settings },
  { id: "api", label: "API", icon: KeyRound }
];

export function WorkbenchShell({
  topbar,
  content,
  composer
}: {
  topbar: ReactNode;
  content: ReactNode;
  composer: ReactNode;
}) {
  const view = useComposerStore((state) => state.view);
  const setView = useComposerStore((state) => state.setView);

  return (
    <div className="grid h-screen grid-cols-1 bg-background text-foreground lg:grid-cols-[248px_1fr]">
      <aside className="hidden border-r border-border bg-card/80 lg:flex lg:flex-col lg:px-3 lg:py-6">
        <div className="mb-10 flex items-center gap-3 px-3">
          <div className="grid size-10 place-items-center rounded-card border border-primary/30 bg-primary/10 text-primary shadow-primary-ring">
            <Compass className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xl font-semibold">影栈 Studio</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-2" aria-label="主导航">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button
                aria-current={active ? "page" : undefined}
                aria-label={item.label}
                className={cn(
                  "group relative flex h-12 items-center gap-3 rounded-button px-4 text-sm text-muted-foreground transition",
                  "hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
                  active && "bg-muted text-foreground"
                )}
                key={item.id}
                onClick={() => setView(item.id)}
                title={item.label}
                type="button"
              >
                {active ? <span className="absolute left-0 top-2 h-8 w-0.5 rounded-full bg-primary" aria-hidden="true" /> : null}
                <span className={cn("grid size-7 place-items-center rounded-button", active && "bg-primary/15 text-primary shadow-primary-ring")}>
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="rounded-card border border-border bg-surface p-3">
          <div className="flex items-center gap-3">
            <span className="grid size-8 place-items-center rounded-full bg-primary/20 text-sm font-semibold text-primary">K</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">kryon</p>
              <p className="text-xs text-muted-foreground">专业版</p>
            </div>
          </div>
          <div className="mt-4 space-y-2 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>存储空间</span>
              <span>128.3GB / 500GB</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <span className="block h-full w-1/4 rounded-full bg-primary" />
            </div>
          </div>
        </div>
      </aside>
      <main className="grid h-screen min-h-0 min-w-0 grid-rows-[auto_1fr_auto] overflow-hidden">
        {topbar}
        <section aria-label="工作区内容" className="studio-scrollbar min-h-0 overflow-auto">
          {content}
        </section>
        <footer className="border-t border-border bg-card/95">{composer}</footer>
      </main>
    </div>
  );
}
