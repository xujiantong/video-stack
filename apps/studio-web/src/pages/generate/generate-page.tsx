import { WorkbenchDashboard } from "@/features/generation/components/workbench-dashboard";

const projectId = "00000000-0000-4000-8000-000000000001";

export function GeneratePage() {
  return <WorkbenchDashboard projectId={projectId} />;
}
