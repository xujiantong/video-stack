import { WorkbenchShell } from "@/components/layout/workbench-shell";
import { Topbar } from "@/components/layout/topbar";
import { GenerationComposer } from "@/features/generation/components/generation-composer";
import { StudioRoutes } from "./routes";
import { AppProviders } from "./providers";

function StudioApp() {
  return <WorkbenchShell topbar={<Topbar />} content={<StudioRoutes />} composer={<GenerationComposer />} />;
}

export default function App() {
  return (
    <AppProviders>
      <StudioApp />
    </AppProviders>
  );
}
