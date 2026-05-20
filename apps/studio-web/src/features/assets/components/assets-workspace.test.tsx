import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssetsWorkspace } from "./assets-workspace";
import { useComposerStore } from "@/lib/stores/composer-store";

const generatedAssetId = "00000000-0000-4000-8000-000000000701";
const projectId = "00000000-0000-4000-8000-000000000001";

function renderWorkspace() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AssetsWorkspace />
    </QueryClientProvider>
  );
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: 200
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  useComposerStore.getState().removeAsset(generatedAssetId);
});

describe("AssetsWorkspace", () => {
  it("syncs generated video assets from the local asset API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.startsWith("/api/assets?")) {
          return jsonResponse([
            {
              id: generatedAssetId,
              projectId,
              userId: "00000000-0000-4000-8000-000000000501",
              kind: "video",
              mimeType: "video/mp4",
              name: "即梦生成-demo.mp4",
              sizeBytes: 1_487_015,
              durationMs: null,
              status: "ready",
              tosBucket: "local",
              tosKey: `${projectId}/results/demo.mp4`,
              storageKey: `${projectId}/results/demo.mp4`,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              deletedAt: null
            }
          ]);
        }
        if (url.startsWith("/api/generation/tasks?")) {
          return jsonResponse([]);
        }
        return jsonResponse([]);
      })
    );

    renderWorkspace();

    const nameCell = await screen.findByText("即梦生成-demo");
    const row = nameCell.closest("tr");
    expect(row).not.toBeNull();
    expect(within(row!).getByText("video")).toBeInTheDocument();
    expect(within(row!).getByRole("button", { name: "查看资产" })).toBeEnabled();

    fireEvent.click(nameCell);
    expect(await screen.findByRole("dialog", { name: "资产预览" })).toBeInTheDocument();
  });
});
