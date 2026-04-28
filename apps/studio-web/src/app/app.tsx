import { WorkbenchShell } from "@/components/layout/workbench-shell";
import { Topbar } from "@/components/layout/topbar";
import { GenerationComposer } from "@/features/generation/components/generation-composer";
import { useComposerStore } from "@/lib/stores/composer-store";
import { LoginPage } from "@/pages/login/login-page";
import { StudioRoutes } from "./routes";
import { AppProviders } from "./providers";

function StudioApp() {
  const view = useComposerStore((state) => state.view);
  if (view === "login" || window.location.pathname === "/login") return <LoginPage />;

  return <WorkbenchShell topbar={<Topbar />} content={<StudioRoutes />} composer={<GenerationComposer />} />;
}

export default function App() {
  return (
    <AppProviders>
      <StudioApp />
    </AppProviders>
  );
}
