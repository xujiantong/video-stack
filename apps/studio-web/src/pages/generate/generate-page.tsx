import { TaskHistoryStream } from "@/features/task-history/task-history-stream";

const projectId = "00000000-0000-4000-8000-000000000001";

export function GeneratePage() {
  return <TaskHistoryStream projectId={projectId} />;
}
