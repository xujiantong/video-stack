import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AtSign, Calculator, Plus, SendHorizontal, ShieldAlert, Sparkles } from "lucide-react";
import { expectedImageAssetCount, isImageGenerationParameters, type AssetMention, type EstimateGenerationResponse, type GenerationTask } from "@video-stack/shared";
import { ModelParameterToolbar } from "./model-parameter-toolbar";
import { buildPromptDoc, PromptEditor, type MentionMenuAsset } from "./prompt-editor";
import { Button } from "@/components/ui/button";
import { Dialog, DialogCloseButton, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toFileType, toSizeLabel, toSupportedUploadMimeType } from "@/features/assets/components/asset-utils";
import { assetsKey, completeAssetUpload, listAssets, presignAssetUpload, uploadAssetBytes } from "@/lib/api/assets-api";
import { createGenerationTask, estimateGeneration, generationTaskKey, generationTasksKey, listGenerationModels } from "@/lib/api/generation-api";
import { useComposerStore, type StudioAsset } from "@/lib/stores/composer-store";

const projectId = "00000000-0000-4000-8000-000000000001";
const credentialId = "00000000-0000-4000-8000-000000000401";

export function GenerationComposer() {
  const queryClient = useQueryClient();
  const [confirmEstimate, setConfirmEstimate] = useState<EstimateGenerationResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const prompt = useComposerStore((state) => state.prompt);
  const promptDoc = useComposerStore((state) => state.promptDoc);
  const assetRefs = useComposerStore((state) => state.assetRefs);
  const parameters = useComposerStore((state) => state.parameters);
  const assets = useComposerStore((state) => state.assets);
  const setPromptDoc = useComposerStore((state) => state.setPromptDoc);
  const setParameters = useComposerStore((state) => state.setParameters);
  const upsertAsset = useComposerStore((state) => state.upsertAsset);
  const setAssetStatus = useComposerStore((state) => state.setAssetStatus);

  const modelsQuery = useQuery({
    queryKey: ["models"],
    queryFn: listGenerationModels,
    staleTime: 5 * 60 * 1000
  });
  const models = modelsQuery.data ?? [];
  const assetsQuery = useQuery({
    queryKey: assetsKey(projectId),
    queryFn: async () => {
      try {
        return await listAssets(projectId);
      } catch {
        return [];
      }
    },
    staleTime: 10_000
  });
  const expectedImages = expectedImageAssetCount(parameters);
  const isImageGeneration = isImageGenerationParameters(parameters);
  const selectableAssets = expectedImages > 0 ? assets.filter((asset) => asset.kind === "image" && asset.status === "ready") : [];
  const mentionAssets = assets.map((asset): MentionMenuAsset => {
    let disabledReason: string | undefined;
    if (expectedImages === 0) {
      disabledReason = "当前模式不用";
    } else if (asset.kind !== "image") {
      disabledReason = "仅支持图片";
    } else if (asset.status !== "ready") {
      disabledReason = asset.status === "uploading" ? "上传中" : "不可用";
    }
    return { id: asset.id, kind: asset.kind, label: asset.label, ...(asset.previewUrl ? { previewUrl: asset.previewUrl } : {}), ...(disabledReason ? { disabledReason } : {}) };
  });
  const emptyAssetMessage =
    expectedImages === 0
      ? "当前生成类型不使用参考资产。切到图生视频、参考图或首尾帧后，可以引用图片资产。"
      : "没有可引用的图片资产，请上传图片或等待上传完成。";

  useEffect(() => {
    for (const asset of assetsQuery.data ?? []) {
      upsertAsset({
        id: asset.id,
        kind: asset.kind,
        label: asset.name.replace(/\.[^/.]+$/, "") || asset.name,
        fileType: toFileType(asset.mimeType),
        sizeLabel: toSizeLabel(asset.sizeBytes),
        references: 0,
        createdAt: "刚刚",
        status: asset.status === "ready" || asset.status === "uploading" ? asset.status : "failed",
        ...(asset.status === "ready" ? { previewUrl: `/api/assets/${asset.id}/content` } : {})
      } satisfies StudioAsset);
    }
  }, [assetsQuery.data, upsertAsset]);

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
      queryClient.setQueryData<GenerationTask[]>(generationTasksKey(projectId), (tasks) => {
        const nextTasks = tasks?.filter((item) => item.id !== task.id) ?? [];
        return [...nextTasks, task];
      });
      queryClient.setQueryData(generationTaskKey(task.id), task);
      void queryClient.invalidateQueries({ queryKey: generationTasksKey(projectId) });
      setConfirmEstimate(null);
    }
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File): Promise<AssetMention | null> => {
      const fileType = toFileType(file.type);
      const mimeType = toSupportedUploadMimeType(file);
      const previewUrl = fileType === "image" ? URL.createObjectURL(file) : undefined;
      const presign = await presignAssetUpload({
        projectId,
        fileName: file.name,
        mimeType,
        sizeBytes: file.size,
        durationMs: null
      });
      const uploadedAsset: StudioAsset = {
        id: presign.assetId,
        kind: fileType,
        label: file.name.replace(/\.[^/.]+$/, "") || file.name,
        fileType,
        sizeLabel: toSizeLabel(file.size),
        references: 0,
        createdAt: "刚刚",
        status: "uploading",
        ...(previewUrl ? { previewUrl } : {})
      };
      upsertAsset(uploadedAsset);
      try {
        await uploadAssetBytes(presign.uploadUrl, presign.uploadHeaders, file);
        await completeAssetUpload({ assetId: presign.assetId, projectId, storageKey: presign.storageKey });
        setAssetStatus(presign.assetId, "ready");
        void queryClient.invalidateQueries({ queryKey: assetsKey(projectId) });
        return { id: presign.assetId, kind: fileType, label: uploadedAsset.label };
      } catch (error) {
        setAssetStatus(presign.assetId, "failed", error instanceof Error ? error.message : "上传失败，请重试。");
        return null;
      }
    },
    onSuccess(asset) {
      if (!asset || asset.kind !== "image" || expectedImages === 0) return;
      appendAssetReference(asset);
    }
  });

  const estimate = estimateMutation.data;
  const costCents = estimate?.estimatedCostCents ?? 0;
  const showSecondConfirm = Boolean(estimate?.requiresSecondConfirm) || costCents >= 2_000;
  const estimatedSeconds = estimate?.estimatedSeconds ?? parameters.durationSeconds * 6;
  const confirmCostCents = confirmEstimate?.estimatedCostCents ?? costCents;
  const actionError = uploadMutation.error ?? createMutation.error ?? estimateMutation.error;

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

  function appendAssetReference(asset: AssetMention) {
    const separator = prompt.trim().length === 0 || /\s$/.test(prompt) ? "" : " ";
    const nextPrompt = `${prompt}${separator}@${asset.label} `;
    const assetsForPrompt = selectableAssets.some((item) => item.id === asset.id) ? selectableAssets : [asset, ...selectableAssets];
    const built = buildPromptDoc(nextPrompt, assetsForPrompt);
    setPromptDoc(built.promptDoc, built.assetRefs, nextPrompt);
  }

  function handleParametersChange(nextParameters: typeof parameters) {
    setParameters(nextParameters);
    const nextExpectedImages = expectedImageAssetCount(nextParameters);
    const nextAssets = nextExpectedImages > 0 ? assets.filter((asset) => asset.kind === "image" && asset.status === "ready") : [];
    const built = buildPromptDoc(prompt, nextAssets);
    setPromptDoc(built.promptDoc, built.assetRefs, prompt);
  }

  function handleReferenceFile(files: FileList | null) {
    const file = files?.item?.(0) ?? files?.[0];
    if (!file) return;
    uploadMutation.mutate(file);
  }

  return (
    <div className="px-4 py-3">
      <div className="mx-auto max-w-[1120px] rounded-[28px] border border-border bg-surface-raised px-5 py-4 shadow-composer">
        <div className="grid grid-cols-[76px_minmax(0,1fr)] gap-4">
          <input
            ref={fileInputRef}
            aria-label="选择本地参考内容"
            accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime,audio/mpeg,audio/wav"
            className="hidden"
            onChange={(event) => {
              handleReferenceFile(event.target.files);
              event.target.value = "";
            }}
            type="file"
          />
          <Button
            aria-label="上传参考内容"
            className="h-24 w-16 -rotate-6 self-start border-dashed bg-muted/50 px-0 text-muted-foreground hover:text-primary"
            disabled={uploadMutation.isPending}
            onClick={() => fileInputRef.current?.click()}
            type="button"
            variant="secondary"
          >
            <span className="grid place-items-center gap-1">
              <Plus className="size-5" aria-hidden="true" />
              <span className="text-[11px]">{uploadMutation.isPending ? "上传中" : "参考内容"}</span>
            </span>
          </Button>
          <span className="sr-only">{emptyAssetMessage}</span>
          <div className="min-w-0">
            <PromptEditor
              assets={selectableAssets}
              assetRefs={assetRefs}
              emptyAssetMessage={emptyAssetMessage}
              layout="chat"
              mentionAssets={mentionAssets}
              prompt={prompt}
              promptDoc={promptDoc}
              onPromptDocChange={setPromptDoc}
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          {models.length > 0 ? <ModelParameterToolbar models={models} parameters={parameters} onParametersChange={handleParametersChange} /> : null}
          <div className="ml-auto flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              className="h-10 px-4 text-sm"
              onClick={() => estimateMutation.mutate({ projectId, promptText: prompt, assetRefs, parameters })}
              disabled={prompt.trim().length === 0 || estimateMutation.isPending}
            >
              <Calculator className="size-4" aria-hidden="true" />
              预估
            </Button>
            <Button
              aria-label="引用第一个资产"
              className="size-10 px-0 text-primary"
              disabled={selectableAssets.length === 0}
              onClick={() => {
                const firstAsset = selectableAssets[0];
                if (firstAsset) appendAssetReference(firstAsset);
              }}
              type="button"
              variant="secondary"
            >
              <AtSign className="size-4" aria-hidden="true" />
            </Button>
            <span className="flex items-center gap-1 px-2 text-sm font-semibold text-muted-foreground" title={`预计等待 ${estimatedSeconds} 秒`}>
              <span className="sr-only">预计消耗</span>
              <Sparkles className="size-4" aria-hidden="true" />
              {costCents}
            </span>
            <Button
              type="button"
              className="size-12 rounded-full px-0"
              aria-label="生成"
              onClick={handleGenerate}
              disabled={prompt.trim().length === 0 || createMutation.isPending || estimateMutation.isPending}
            >
              <SendHorizontal className="-rotate-90 size-5" aria-hidden="true" />
            </Button>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
          {showSecondConfirm ? (
            <p className="flex items-start gap-1.5 text-xs leading-5 text-warning">
              <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              本次费用较高，请确认后生成。
            </p>
          ) : null}
          {actionError ? (
            <p className="rounded-card border border-danger/30 bg-danger/10 px-2.5 py-1.5 text-xs leading-5 text-danger" role="alert">
              {actionError instanceof Error ? actionError.message : "生成失败，请检查参数后重试。"}
            </p>
          ) : null}
        </div>
        <span className="sr-only">{credentialId}</span>
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
          系统会使用当前模型{isImageGeneration ? "生成图片。" : "、分辨率和时长生成视频。"}
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
