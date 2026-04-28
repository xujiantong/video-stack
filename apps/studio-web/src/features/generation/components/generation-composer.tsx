import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AtSign, Calculator, SendHorizontal, ShieldAlert, Upload } from "lucide-react";
import type { EstimateGenerationResponse, GenerationTask } from "@video-stack/shared";
import { ModelParameterToolbar } from "./model-parameter-toolbar";
import { PromptEditor } from "./prompt-editor";
import { Button } from "@/components/ui/button";
import { Dialog, DialogCloseButton, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createGenerationTask, estimateGeneration, listGenerationModels } from "@/lib/api/generation-api";
import { useComposerStore } from "@/lib/stores/composer-store";

const projectId = "00000000-0000-4000-8000-000000000001";
const credentialId = "00000000-0000-4000-8000-000000000401";

export function GenerationComposer() {
  const [confirmEstimate, setConfirmEstimate] = useState<EstimateGenerationResponse | null>(null);
  const prompt = useComposerStore((state) => state.prompt);
  const promptDoc = useComposerStore((state) => state.promptDoc);
  const assetRefs = useComposerStore((state) => state.assetRefs);
  const parameters = useComposerStore((state) => state.parameters);
  const assets = useComposerStore((state) => state.assets);
  const setPromptDoc = useComposerStore((state) => state.setPromptDoc);
  const setParameters = useComposerStore((state) => state.setParameters);
  const addTask = useComposerStore((state) => state.addTask);

  const modelsQuery = useQuery({
    queryKey: ["models"],
    queryFn: listGenerationModels,
    staleTime: 5 * 60 * 1000
  });
  const models = modelsQuery.data ?? [];

  const estimateMutation = useMutation({
    mutationFn: estimateGeneration
  });

  const createMutation = useMutation({
    mutationFn: async (input: { estimate: EstimateGenerationResponse; secondConfirmToken?: string }): Promise<GenerationTask> =>
      createGenerationTask({
        projectId,
        provider: "jimeng",
        credentialId,
        promptDoc,
        promptText: prompt,
        parameters,
        assetRefs,
        secondConfirmToken: input.secondConfirmToken,
        fallbackEstimate: input.estimate
      }),
    onSuccess(task) {
      addTask(task);
      setConfirmEstimate(null);
    }
  });

  const estimate = estimateMutation.data;
  const costCents = estimate?.estimatedCostCents ?? Math.max(300, prompt.length * 2);
  const showSecondConfirm = Boolean(estimate?.requiresSecondConfirm) || costCents >= 2_000;
  const estimatedSeconds = estimate?.estimatedSeconds ?? parameters.durationSeconds * 6;
  const confirmCostCents = confirmEstimate?.estimatedCostCents ?? costCents;

  async function estimateCurrentPrompt() {
    return estimateMutation.mutateAsync({ projectId, promptText: prompt, assetRefs, parameters });
  }

  async function handleGenerate() {
    const nextEstimate = await estimateCurrentPrompt();
    if (nextEstimate.requiresSecondConfirm) {
      setConfirmEstimate(nextEstimate);
      return;
    }
    createMutation.mutate({ estimate: nextEstimate });
  }

  function confirmHighCostGeneration() {
    if (!confirmEstimate?.secondConfirmToken) return;
    createMutation.mutate({ estimate: confirmEstimate, secondConfirmToken: confirmEstimate.secondConfirmToken });
  }

  return (
    <div className="px-4 py-3">
      <div className="mx-auto grid max-w-6xl gap-4 rounded-composer border border-border bg-surface-raised p-4 shadow-composer lg:grid-cols-[1fr_280px]">
        <div className="min-w-0">
          <PromptEditor assets={assets} assetRefs={assetRefs} prompt={prompt} promptDoc={promptDoc} onPromptDocChange={setPromptDoc} />
          <div className="mt-3 flex flex-wrap items-start gap-2 border-t border-border pt-3">
            {models.length > 0 ? <ModelParameterToolbar models={models} parameters={parameters} onParametersChange={setParameters} /> : null}
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
            <p className="mt-1 text-xs text-muted-foreground">预计等待 {estimatedSeconds} 秒</p>
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
              onClick={() => estimateMutation.mutate({ projectId, promptText: prompt, assetRefs, parameters })}
              disabled={prompt.trim().length === 0 || estimateMutation.isPending}
            >
              <Calculator className="size-4" aria-hidden="true" />
              预估费用
            </Button>
            <Button
              type="button"
              className="size-10 rounded-full px-0"
              aria-label="生成"
              onClick={handleGenerate}
              disabled={prompt.trim().length === 0 || createMutation.isPending || estimateMutation.isPending}
            >
              <SendHorizontal className="-rotate-90 size-4" aria-hidden="true" />
            </Button>
          </div>
          <span className="sr-only">{credentialId}</span>
        </div>
      </div>
      <Dialog open={confirmEstimate !== null} title="确认高费用生成" onOpenChange={(open) => !open && setConfirmEstimate(null)}>
        <DialogHeader>
          <div>
            <DialogTitle>确认高费用生成</DialogTitle>
            <DialogDescription>本次预计 ¥{(confirmCostCents / 100).toFixed(2)}。确认后创建任务。</DialogDescription>
          </div>
          <DialogCloseButton onClose={() => setConfirmEstimate(null)} />
        </DialogHeader>
        <div className="rounded-card border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
          系统会使用当前模型、分辨率和时长生成视频。
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setConfirmEstimate(null)}>
            取消
          </Button>
          <Button type="button" onClick={confirmHighCostGeneration} disabled={!confirmEstimate?.secondConfirmToken || createMutation.isPending}>
            确认生成
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
