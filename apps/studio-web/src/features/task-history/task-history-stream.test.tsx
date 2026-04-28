import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GenerationTask } from "@video-stack/shared";
import { TaskHistoryStream } from "./task-history-stream";

const projectId = "00000000-0000-4000-8000-000000000001";
const baseTask: GenerationTask = {
  id: "00000000-0000-4000-8000-000000000202",
  projectId,
  provider: "jimeng",
  promptText: "把镜头改成俯拍，增加字幕",
  parameters: {
    modelId: "seedance-lite",
    mode: "text_to_video",
    referenceMode: "none",
    aspectRatio: "16:9",
    resolution: "720p",
    durationSeconds: 5
  },
  assetRefs: [],
  status: "running",
  estimatedCostCents: 1120,
  actualCostCents: null,
  requiresSecondConfirm: false,
  resultAssetId: null,
  errorMessage: null,
  createdAt: "2026-04-28T08:00:00.000Z",
  updatedAt: "2026-04-28T08:00:00.000Z"
};

function renderStream() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <TaskHistoryStream pollIntervalMs={25} projectId={projectId} />
    </QueryClientProvider>
  );
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("TaskHistoryStream", () => {
  it("polls active tasks until the task reaches a final state", async () => {
    const completedTask: GenerationTask = {
      ...baseTask,
      status: "succeeded",
      actualCostCents: 1120,
      resultAssetId: "00000000-0000-4000-8000-000000000301",
      updatedAt: "2026-04-28T08:00:02.000Z",
      finishedAt: "2026-04-28T08:00:02.000Z"
    };
    let detailReads = 0;
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/api/generation/tasks?")) return jsonResponse([detailReads > 0 ? completedTask : baseTask]);
      detailReads += 1;
      return jsonResponse(detailReads > 1 ? completedTask : baseTask);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderStream();

    expect(await screen.findByText("生成中")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("已完成")).toBeInTheDocument());
  });

  it("shows a concrete next step when a failed task has no provider message", async () => {
    const failedTask: GenerationTask = {
      ...baseTask,
      status: "failed",
      errorMessage: null,
      updatedAt: "2026-04-28T08:00:02.000Z",
      finishedAt: "2026-04-28T08:00:02.000Z"
    };
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse([failedTask])));

    renderStream();

    expect(await screen.findByRole("alert")).toHaveTextContent("生成失败，请稍后重试或查看详情。");
  });
});
