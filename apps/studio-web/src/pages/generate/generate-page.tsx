import { TaskHistoryStream } from "@/features/task-history/task-history-stream";
import { useComposerStore } from "@/lib/stores/composer-store";

export function GeneratePage() {
  const tasks = useComposerStore((state) => state.tasks);
  return <TaskHistoryStream tasks={tasks} />;
}
