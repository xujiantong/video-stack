import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Film, Upload } from "lucide-react";
import { WorkbenchShell } from "@/components/layout/workbench-shell";
import { TaskHistoryStream } from "@/components/task-history/task-history-stream";
import { GenerationComposer } from "@/features/generation/generation-composer";
import { Button } from "@/components/ui/button";
import { useComposerStore } from "@/lib/stores/composer-store";

const queryClient = new QueryClient();

function PreviewStage() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">当前项目</p>
          <h2 className="mt-1 text-2xl font-semibold">产品短片工作台</h2>
        </div>
        <Button type="button" variant="secondary">
          <Upload className="size-4" aria-hidden="true" />
          上传素材
        </Button>
      </header>
      <div className="grid flex-1 place-items-center p-6">
        <div className="aspect-video w-full max-w-5xl overflow-hidden rounded-md border border-border bg-card">
          <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_50%_35%,hsl(183_78%_18%),transparent_34%),linear-gradient(135deg,hsl(220_16%_9%),hsl(220_18%_4%))]">
            <div className="text-center">
              <Film className="mx-auto size-12 text-primary" aria-hidden="true" />
              <p className="mt-4 text-lg font-medium">等待生成结果</p>
              <p className="mt-2 text-sm text-muted-foreground">任务完成后，视频会显示在这里。</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StudioApp() {
  const tasks = useComposerStore((state) => state.tasks);

  return <WorkbenchShell history={<TaskHistoryStream tasks={tasks} />} preview={<PreviewStage />} composer={<GenerationComposer />} />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <StudioApp />
    </QueryClientProvider>
  );
}
