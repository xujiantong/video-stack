import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GenerationComposer } from "./generation-composer";

function renderComposer() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <GenerationComposer />
    </QueryClientProvider>
  );
}

describe("GenerationComposer", () => {
  it("estimates cost and creates a queued task", async () => {
    renderComposer();

    fireEvent.change(screen.getByRole("textbox", { name: "Prompt" }), {
      target: { value: "生成 8 秒产品展示视频" }
    });
    fireEvent.click(screen.getByRole("button", { name: "预估费用" }));

    await waitFor(() => expect(screen.getByText("¥3.00")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "生成" }));

    await waitFor(() => expect(screen.getAllByText("预计费用").length).toBeGreaterThan(0));
  });
});
