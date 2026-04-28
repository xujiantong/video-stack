import type { ReactNode } from "react";

export function WorkbenchShell({
  history,
  preview,
  composer
}: {
  history: ReactNode;
  preview: ReactNode;
  composer: ReactNode;
}) {
  return (
    <div className="grid h-screen grid-cols-1 bg-background text-foreground lg:grid-cols-[320px_1fr]">
      <aside className="hidden border-r border-border bg-card lg:block">{history}</aside>
      <main className="grid min-w-0 grid-rows-[1fr_auto]">
        <section className="min-h-0 overflow-auto">{preview}</section>
        <footer className="border-t border-border bg-card">{composer}</footer>
      </main>
    </div>
  );
}
