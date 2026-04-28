import { Film, PanelRightClose, X } from "lucide-react";
import type { GenerationTask } from "@video-stack/shared";
import { AssetIcon } from "@/components/domain/asset-icon";
import { Badge } from "@/components/ui/badge";
import { Drawer, DrawerBody, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import type { StudioAsset } from "@/lib/stores/composer-store";
import { IconAction } from "./icon-action";

export function TaskDetailDrawer({ assets, onClose, task }: { assets: StudioAsset[]; onClose(): void; task: GenerationTask | undefined }) {
  const referencedAssets = assets.filter((asset) => task?.assetRefs.some((ref) => ref.id === asset.id) ?? false);
  const costCents = (task?.actualCostCents ?? task?.estimatedCostCents) ?? 0;
  const parameterBadges = [
    { key: "model", value: task?.parameters?.modelId ?? "Seedance 2.0" },
    { key: "mode", value: task?.parameters?.mode ?? "全能参考" },
    { key: "ratio", value: task?.parameters?.aspectRatio ?? "16:9" },
    { key: "resolution", value: task?.parameters?.resolution.toUpperCase() ?? "1080P" },
    { key: "duration", value: task?.parameters ? `${task.parameters.durationSeconds}s` : "8s" },
    { key: "cost", value: `¥${(costCents / 100).toFixed(2)}` }
  ];

  return (
    <Drawer>
      <DrawerHeader>
        <DrawerTitle>任务详情</DrawerTitle>
        <IconAction label="关闭详情" onClick={onClose}>
          {task ? <PanelRightClose className="size-4" aria-hidden="true" /> : <X className="size-4" aria-hidden="true" />}
        </IconAction>
      </DrawerHeader>
      <div className="mt-4 aspect-video rounded-card border border-border bg-background">
        <div className="grid h-full place-items-center text-muted-foreground">
          <Film className="size-8" aria-hidden="true" />
        </div>
      </div>
      <DrawerBody>
        <section>
          <p className="mb-2 text-xs uppercase text-muted-foreground">原始提示词</p>
          <p className="rounded-card bg-muted p-3 leading-6">{task?.promptText ?? "请选择一个任务查看详情。"}</p>
        </section>
        <section>
          <p className="mb-2 text-xs uppercase text-muted-foreground">参数快照</p>
          <div className="grid grid-cols-2 gap-2">
            {parameterBadges.map((item) => (
              <Badge className="justify-center py-2" key={item.key}>
                {item.value}
              </Badge>
            ))}
          </div>
        </section>
        <section>
          <p className="mb-2 text-xs uppercase text-muted-foreground">引用资产</p>
          <div className="flex gap-2">
            {referencedAssets.map((asset) => (
              <AssetIcon asset={asset} key={asset.id} />
            ))}
            {task && task.assetRefs.length === 0 ? <p className="text-muted-foreground">当前任务没有引用资产。</p> : null}
          </div>
        </section>
      </DrawerBody>
    </Drawer>
  );
}
