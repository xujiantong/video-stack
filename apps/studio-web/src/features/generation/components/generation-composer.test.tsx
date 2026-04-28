import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GenerationComposer } from "./generation-composer";

function renderComposer() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <GenerationComposer />
    </QueryClientProvider>
  );
}

afterEach(() => cleanup());

describe("GenerationComposer", () => {
  it("estimates cost and creates a queued task", async () => {
    renderComposer();

    fireEvent.change(screen.getByRole("textbox", { name: "Prompt" }), {
      target: { value: "生成 8 秒产品展示视频" }
    });
    fireEvent.click(screen.getByRole("button", { name: "预估费用" }));

    await waitFor(() => expect(screen.getByText("预计费用")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "生成" }));

    await waitFor(() => expect(screen.getAllByText("预计费用").length).toBeGreaterThan(0));
  });

  it("falls back unsupported parameters when switching models", async () => {
    renderComposer();

    const modelSelect = await screen.findByLabelText("模型");

    fireEvent.change(modelSelect, { target: { value: "seedance-pro" } });
    fireEvent.change(screen.getByLabelText("参考模式"), { target: { value: "image_audio" } });
    fireEvent.change(screen.getByLabelText("比例"), { target: { value: "4:3" } });
    fireEvent.change(screen.getByLabelText("时长"), { target: { value: "15" } });

    fireEvent.change(screen.getByLabelText("模型"), { target: { value: "seedance-lite" } });

    expect(screen.getByLabelText<HTMLSelectElement>("参考模式").value).toBe("none");
    expect(screen.getByLabelText<HTMLSelectElement>("比例").value).toBe("16:9");
    expect(screen.getByLabelText<HTMLSelectElement>("时长").value).toBe("5");
    expect(screen.getByText("已按 Seedance Lite 能力调整参数。")).toBeInTheDocument();
  });

  it("asks for confirmation before creating a high cost task", async () => {
    renderComposer();

    fireEvent.change(screen.getByRole("textbox", { name: "Prompt" }), {
      target: { value: "高成本生成".repeat(300) }
    });
    fireEvent.click(screen.getByRole("button", { name: "生成" }));

    expect(await screen.findByRole("dialog", { name: "确认高费用生成" })).toBeInTheDocument();
    expect(screen.getByText(/确认后创建任务/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "确认生成" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "确认高费用生成" })).not.toBeInTheDocument());
  });
});
