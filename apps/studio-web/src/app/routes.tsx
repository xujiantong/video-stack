import { AssetsPage } from "@/pages/assets/assets-page";
import { ApiSettingsPage } from "@/pages/api-settings/api-settings-page";
import { GeneratePage } from "@/pages/generate/generate-page";
import { PlaceholderPage } from "@/pages/generate/placeholder-page";
import { LoginPage } from "@/pages/login/login-page";
import { useComposerStore } from "@/lib/stores/composer-store";

export function StudioRoutes() {
  const view = useComposerStore((state) => state.view);
  if (view === "assets") return <AssetsPage />;
  if (view === "api") return <ApiSettingsPage />;
  if (view === "login") return <LoginPage />;
  if (view === "settings" || view === "inspiration" || view === "canvas") return <PlaceholderPage />;
  return <GeneratePage />;
}
