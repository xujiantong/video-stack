import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { isImageGenerationParameters } from "@video-stack/shared";
import type {
  AspectRatio,
  GenerationMode,
  GenerationParameters,
  ModelCapability,
  ReferenceMode,
  VideoDurationSeconds,
  VideoResolution
} from "@video-stack/shared";
import { cn } from "@/lib/utils";

type ParameterKey = Exclude<keyof GenerationParameters, "modelId">;

const modeLabels: Record<GenerationMode, string> = {
  text_to_video: "文生视频",
  image_to_video: "图生视频",
  first_last_frame: "首尾帧",
  reference_to_video: "参考生成",
  text_to_image: "文生图"
};

const referenceModeLabels: Record<ReferenceMode, string> = {
  none: "无参考",
  image: "图片参考",
  audio: "音频参考",
  image_audio: "图音参考",
  first_last_frame: "首尾帧"
};

const fieldLabels: Record<ParameterKey, string> = {
  mode: "生成类型",
  referenceMode: "参考模式",
  aspectRatio: "比例",
  resolution: "分辨率",
  durationSeconds: "时长"
};

const quotaStatusLabels: Partial<Record<ModelCapability["quotaStatus"], string>> = {
  free_trial: "免费试用",
  exhausted: "额度用尽"
};

function firstValue<T>(values: readonly T[], field: string): T {
  const value = values[0];
  if (value === undefined) throw new Error(`模型缺少${field}配置`);
  return value;
}

function normalizeParameters(model: ModelCapability, current: GenerationParameters): GenerationParameters {
  return {
    modelId: model.id,
    mode: model.supportedModes.includes(current.mode) ? current.mode : firstValue(model.supportedModes, "生成类型"),
    referenceMode: model.supportedReferenceModes.includes(current.referenceMode)
      ? current.referenceMode
      : firstValue(model.supportedReferenceModes, "参考模式"),
    aspectRatio: model.supportedRatios.includes(current.aspectRatio) ? current.aspectRatio : firstValue(model.supportedRatios, "比例"),
    resolution: model.supportedResolutions.includes(current.resolution) ? current.resolution : firstValue(model.supportedResolutions, "分辨率"),
    durationSeconds: model.supportedDurations.includes(current.durationSeconds)
      ? current.durationSeconds
      : firstValue(model.supportedDurations, "时长")
  };
}

function didAdjust(left: GenerationParameters, right: GenerationParameters): boolean {
  return (
    left.mode !== right.mode ||
    left.referenceMode !== right.referenceMode ||
    left.aspectRatio !== right.aspectRatio ||
    left.resolution !== right.resolution ||
    left.durationSeconds !== right.durationSeconds
  );
}

function collectValues<T>(models: ModelCapability[], read: (model: ModelCapability) => readonly T[]): T[] {
  return Array.from(new Set(models.flatMap((model) => read(model))));
}

function labelFor(field: ParameterKey, value: GenerationParameters[ParameterKey]): string {
  if (field === "mode") return modeLabels[value as GenerationMode];
  if (field === "referenceMode") return referenceModeLabels[value as ReferenceMode];
  if (field === "durationSeconds") return `${value}s`;
  return String(value).toUpperCase();
}

function labelForModel(model: ModelCapability): string {
  const quotaLabel = quotaStatusLabels[model.quotaStatus];
  return quotaLabel ? `${model.displayName}（${quotaLabel}）` : model.displayName;
}

export function ModelParameterToolbar({
  models,
  parameters,
  onParametersChange
}: {
  models: ModelCapability[];
  parameters: GenerationParameters;
  onParametersChange(parameters: GenerationParameters): void;
}) {
  const [notice, setNotice] = useState("");
  const selectedModel = models.find((model) => model.id === parameters.modelId) ?? firstValue(models, "模型");
  const isImageModel = isImageGenerationParameters(parameters);

  const options = useMemo(
    () => ({
      mode: collectValues(models, (model) => model.supportedModes),
      referenceMode: collectValues(models, (model) => model.supportedReferenceModes),
      aspectRatio: collectValues<AspectRatio>(models, (model) => model.supportedRatios),
      resolution: collectValues(models, (model) => model.supportedResolutions),
      durationSeconds: collectValues<VideoDurationSeconds>(models, (model) => model.supportedDurations)
    }),
    [models]
  );

  function changeModel(modelId: string) {
    const nextModel = models.find((model) => model.id === modelId);
    if (!nextModel) return;
    const nextParameters = normalizeParameters(nextModel, { ...parameters, modelId });
    onParametersChange(nextParameters);
    setNotice(didAdjust(parameters, nextParameters) ? `已按 ${nextModel.displayName} 能力调整参数。` : "");
  }

  function changeParameter<Key extends ParameterKey>(field: Key, rawValue: string) {
    const value = field === "durationSeconds" ? Number(rawValue) : rawValue;
    const nextParameters = normalizeModePair({ ...parameters, [field]: value } as GenerationParameters, field);
    onParametersChange(nextParameters);
    setNotice("");
  }

  function renderSelect<Key extends ParameterKey>(field: Key, values: GenerationParameters[Key][]) {
    const supported = new Set<GenerationParameters[Key]>(
      field === "mode"
        ? (selectedModel.supportedModes as GenerationParameters[Key][])
        : field === "referenceMode"
          ? (selectedModel.supportedReferenceModes as GenerationParameters[Key][])
          : field === "aspectRatio"
            ? (selectedModel.supportedRatios as GenerationParameters[Key][])
            : field === "resolution"
              ? (selectedModel.supportedResolutions as GenerationParameters[Key][])
              : (selectedModel.supportedDurations as GenerationParameters[Key][])
    );

    return (
      <label className="relative inline-flex h-10 items-center">
        <span className="sr-only">{fieldLabels[field]}</span>
        <select
          aria-label={fieldLabels[field]}
          className={cn(
            "h-10 appearance-none rounded-button border border-border bg-muted py-0 pl-4 pr-9 text-sm text-foreground outline-none transition",
            "hover:border-primary/70 focus:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          )}
          value={String(parameters[field])}
          onChange={(event) => changeParameter(field, event.target.value)}
        >
          {values.map((value) => (
            <option key={String(value)} value={String(value)} disabled={!supported.has(value)}>
              {labelFor(field, value)}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 size-3 text-muted-foreground" aria-hidden="true" />
      </label>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        {renderSelect("mode", options.mode)}
        <label className="relative inline-flex h-10 items-center">
          <span className="sr-only">模型</span>
          <select
            aria-label="模型"
            className={cn(
              "h-10 appearance-none rounded-button border border-border bg-muted py-0 pl-4 pr-9 text-sm text-foreground outline-none transition",
              "hover:border-primary/70 focus:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            )}
            value={selectedModel.id}
            onChange={(event) => changeModel(event.target.value)}
          >
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {labelForModel(model)}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 size-3 text-muted-foreground" aria-hidden="true" />
        </label>
        {renderSelect("referenceMode", options.referenceMode)}
        {renderSelect("aspectRatio", options.aspectRatio)}
        {isImageModel ? null : renderSelect("resolution", options.resolution)}
        {isImageModel ? null : renderSelect("durationSeconds", options.durationSeconds)}
      </div>
      <p className={cn("min-h-3 text-[11px] text-warning", notice.length === 0 && "sr-only")} role="status">
        {notice || "参数未调整。"}
      </p>
    </div>
  );
}

function normalizeModePair(parameters: GenerationParameters, changedField: ParameterKey): GenerationParameters {
  if (changedField === "mode") {
    if (parameters.mode === "text_to_image") return { ...parameters, referenceMode: "none" };
    if (parameters.mode === "text_to_video") return { ...parameters, referenceMode: "none" };
    if (parameters.mode === "first_last_frame") return { ...parameters, referenceMode: "first_last_frame" };
    return { ...parameters, referenceMode: "image" };
  }
  if (changedField === "referenceMode") {
    if (parameters.referenceMode === "none") {
      return parameters.modelId.startsWith("jimeng-image-") ? { ...parameters, mode: "text_to_image" } : { ...parameters, mode: "text_to_video" };
    }
    if (parameters.referenceMode === "first_last_frame") return { ...parameters, mode: "first_last_frame" };
    if (parameters.mode === "text_to_video") return { ...parameters, mode: "image_to_video" };
  }
  return parameters;
}
