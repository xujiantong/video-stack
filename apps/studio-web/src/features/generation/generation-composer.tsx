import { useMutation } from "@tanstack/react-query";
import { Calculator, SendHorizontal, ShieldAlert } from "lucide-react";
import type { EstimateGenerationResponse, GenerationTask } from "@video-stack/shared";
import { PromptEditor } from "@/components/editor/prompt-editor";
import { Button } from "@/components/ui/button";
import { useComposerStore } from "@/lib/stores/composer-store";

const projectId = "00000000-0000-4000-8000-000000000001";
const credentialId = "00000000-0000-4000-8000-000000000401";

async function estimateGeneration(promptText: string): Promise<EstimateGenerationResponse> {
  const fallback = {
    estimatedCostCents: Math.max(300, promptText.length * 2),
    estimatedSeconds: 45,
    requiresSecondConfirm: false
  };

  try {
    const response = await fetch("/api/generation/estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, promptText, assetRefs: [], provider: "jimeng" })
    });
    if (!response.ok) return fallback;
    return (await response.json()) as EstimateGenerationResponse;
  } catch {
    return fallback;
  }
}

export function GenerationComposer() {
  const prompt = useComposerStore((state) => state.prompt);
  const assets = useComposerStore((state) => state.assets);
  const setPrompt = useComposerStore((state) => state.setPrompt);
  const addTask = useComposerStore((state) => state.addTask);

  const estimateMutation = useMutation({
    mutationFn: estimateGeneration
  });

  const createMutation = useMutation({
    mutationFn: async (): Promise<GenerationTask> => {
      const now = new Date().toISOString();
      return {
        id: crypto.randomUUID(),
        projectId,
        provider: "jimeng",
        promptText: prompt,
        assetRefs: assets,
        status: "queued",
        estimatedCostCents: estimateMutation.data?.estimatedCostCents ?? Math.max(300, prompt.length * 2),
        actualCostCents: null,
        requiresSecondConfirm: Boolean(estimateMutation.data?.requiresSecondConfirm),
        resultAssetId: null,
        errorMessage: null,
        createdAt: now,
        updatedAt: now
      };
    },
    onSuccess(task) {
      addTask(task);
    }
  });

  const estimate = estimateMutation.data;

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-[1fr_280px]">
      <PromptEditor assets={assets} prompt={prompt} onPromptChange={setPrompt} />
      <div className="flex flex-col justify-between gap-3 rounded-md border border-border bg-background/60 p-3">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">费用</p>
          <div className="rounded-md bg-muted p-3">
            <p className="text-sm text-muted-foreground">预计费用</p>
            <p className="mt-1 text-2xl font-semibold">
              {estimate ? `¥${(estimate.estimatedCostCents / 100).toFixed(2)}` : "待预估"}
            </p>
          </div>
          {estimate?.requiresSecondConfirm ? (
            <p className="flex items-center gap-2 text-sm text-warning">
              <ShieldAlert className="size-4" aria-hidden="true" />
              本次费用较高，生成前需要确认。
            </p>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => estimateMutation.mutate(prompt)}
            disabled={prompt.trim().length === 0 || estimateMutation.isPending}
          >
            <Calculator className="size-4" aria-hidden="true" />
            预估费用
          </Button>
          <Button
            type="button"
            onClick={() => createMutation.mutate()}
            disabled={prompt.trim().length === 0 || createMutation.isPending}
          >
            <SendHorizontal className="size-4" aria-hidden="true" />
            生成
          </Button>
        </div>
        <span className="sr-only">{credentialId}</span>
      </div>
    </div>
  );
}
