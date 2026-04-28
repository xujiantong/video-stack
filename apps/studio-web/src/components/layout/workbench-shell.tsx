import type { ReactNode } from "react";
import { Bot, Boxes, Compass, KeyRound, LayoutDashboard, Settings, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useComposerStore, type StudioView } from "@/lib/stores/composer-store";

const navItems: Array<{ id: StudioView; label: string; icon: typeof Sparkles }> = [
  { id: "inspiration", label: "灵感", icon: Sparkles },
  { id: "generate", label: "生成", icon: Bot },
  { id: "assets", label: "资产", icon: Boxes },
  { id: "canvas", label: "画布", icon: LayoutDashboard },
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
    <div className="grid h-screen grid-cols-1 bg-background text-foreground lg:grid-cols-[72px_1fr]">
      <aside className="hidden border-r border-border bg-card lg:flex lg:flex-col lg:items-center lg:gap-4 lg:py-4">
        <div className="grid size-10 place-items-center rounded-card border border-primary/30 bg-primary/10 text-primary">
          <Compass className="size-5" aria-hidden="true" />
        </div>
        <nav className="flex flex-1 flex-col items-center gap-2" aria-label="主导航">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button
                aria-label={item.label}
                className={cn(
                  "group flex w-14 flex-col items-center gap-1 rounded-button px-2 py-2 text-[11px] text-muted-foreground transition",
                  "hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
                  active && "bg-primary/10 text-primary"
                )}
                key={item.id}
                onClick={() => setView(item.id)}
                title={item.label}
                type="button"
              >
                <Icon className="size-4" aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>
      <main className="grid h-screen min-h-0 min-w-0 grid-rows-[auto_1fr_auto] overflow-hidden">
        {topbar}
        <section className="studio-scrollbar min-h-0 overflow-auto">{content}</section>
        <footer className="border-t border-border bg-card/95">{composer}</footer>
      </main>
    </div>
  );
}
