import { useMutation } from "@tanstack/react-query";
import { AtSign, Calculator, ChevronDown, SendHorizontal, ShieldAlert, Upload } from "lucide-react";
import type { EstimateGenerationResponse, GenerationTask } from "@video-stack/shared";
import { PromptEditor } from "./prompt-editor";
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
  const costCents = estimate?.estimatedCostCents ?? Math.max(300, prompt.length * 2);
  const showSecondConfirm = Boolean(estimate?.requiresSecondConfirm) || costCents >= 2_000;

  return (
    <div className="px-4 py-3">
      <div className="mx-auto grid max-w-6xl gap-4 rounded-composer border border-border bg-surface-raised p-4 shadow-composer lg:grid-cols-[1fr_280px]">
        <div className="min-w-0">
          <PromptEditor assets={assets} prompt={prompt} onPromptChange={setPrompt} />
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            {["视频生成", "Seedance 2.0", "全能参考", "16:9", "1080P", "15s"].map((item) => (
              <Button
                className="h-8 px-3 text-xs"
                key={item}
                type="button"
                variant="secondary"
              >
                {item}
                <ChevronDown className="size-3 text-muted-foreground" aria-hidden="true" />
              </Button>
            ))}
            <Button
              aria-label="打开资产引用菜单"
              className="h-8 px-3 text-xs text-primary"
              type="button"
              variant="secondary"
            >
              <AtSign className="size-3" aria-hidden="true" />
              引用
            </Button>
          </div>
        </div>
        <div className="relative flex flex-col justify-between gap-3">
          <div className="rounded-card border border-border bg-background/60 p-3">
            <p className="text-xs font-medium uppercase text-muted-foreground">预计费用</p>
            <p className="mt-2 text-2xl font-semibold text-warning">¥{(costCents / 100).toFixed(2)}</p>
            {showSecondConfirm ? (
              <p className="mt-2 flex items-start gap-2 text-sm leading-5 text-warning">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                本次费用较高，请确认后生成。
              </p>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">费用按模型、分辨率和时长估算。</p>
            )}
          </div>
          <div className="rounded-popover border border-border bg-background/80 p-2 shadow-popover">
            <p className="mb-2 text-xs text-muted-foreground">可能 @ 的内容</p>
            {assets.map((asset) => (
              <Button className="h-auto w-full justify-start px-2 py-2 text-xs" key={asset.id} type="button" variant="ghost">
                <span className="grid size-7 place-items-center rounded-button bg-muted text-primary">
                  <Upload className="size-3" aria-hidden="true" />
                </span>
                <span>@{asset.label}</span>
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-2">
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
              className="size-10 rounded-full px-0"
              aria-label="生成"
              onClick={() => createMutation.mutate()}
              disabled={prompt.trim().length === 0 || createMutation.isPending}
            >
              <SendHorizontal className="-rotate-90 size-4" aria-hidden="true" />
            </Button>
          </div>
          <span className="sr-only">{credentialId}</span>
        </div>
      </div>
    </div>
  );
}
