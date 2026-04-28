import { useMemo, useRef, useState, type ReactNode } from "react";
import { Copy, Eye, Film, PanelRightClose, PenLine, Trash2, Upload } from "lucide-react";
import { AssetIcon } from "@/components/domain/asset-icon";
import { StatusBadge } from "@/components/domain/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerBody, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip } from "@/components/ui/tooltip";
import { completeAssetUpload, presignAssetUpload, uploadAssetBytes } from "@/lib/api/assets-api";
import { cn } from "@/lib/utils";
import { useComposerStore } from "@/lib/stores/composer-store";

type AssetTab = "assets" | "tasks";

function toSizeLabel(sizeBytes: number): string {
  if (sizeBytes >= 1024 * 1024) return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  if (sizeBytes >= 1024) return `${Math.round(sizeBytes / 1024)} KB`;
  return `${sizeBytes} B`;
}

function toFileType(mimeType: string): "image" | "audio" | "video" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  return "video";
}

function IconAction({ children, danger = false, label }: { children: ReactNode; danger?: boolean; label: string }) {
  return (
    <Tooltip label={label}>
      <Button aria-label={label} className={cn("size-8 px-0", danger && "text-danger")} type="button" variant="ghost">
        {children}
      </Button>
    </Tooltip>
  );
}

export function AssetsPage() {
  const [activeTab, setActiveTab] = useState<AssetTab>("assets");
  const assets = useComposerStore((state) => state.assets);
  const tasks = useComposerStore((state) => state.tasks);
  const upsertAsset = useComposerStore((state) => state.upsertAsset);
  const setAssetStatus = useComposerStore((state) => state.setAssetStatus);
  const removeAsset = useComposerStore((state) => state.removeAsset);
  const selectedTask = tasks[0];
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [retryFiles, setRetryFiles] = useState<Record<string, File>>({});
  const projectId = useMemo(() => tasks[0]?.projectId ?? "00000000-0000-4000-8000-000000000001", [tasks]);

  async function uploadOne(file: File): Promise<string | null> {
    const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
    let nextAssetId: string | null = null;
    try {
      const presign = await presignAssetUpload({
        projectId,
        fileName: file.name,
        mimeType: file.type as never,
        sizeBytes: file.size,
        durationMs: null
      });

      nextAssetId = presign.assetId;
      setRetryFiles((state) => ({ ...state, [presign.assetId]: file }));
      upsertAsset({
        id: presign.assetId,
        kind: toFileType(file.type) === "audio" ? "audio" : toFileType(file.type) === "video" ? "video" : "image",
        label: file.name.replace(/\.[^/.]+$/, "") || file.name,
        fileType: toFileType(file.type),
        sizeLabel: toSizeLabel(file.size),
        references: 0,
        createdAt: "刚刚",
        status: "uploading",
        ...(previewUrl ? { previewUrl } : {})
      });

      await uploadAssetBytes(presign.uploadUrl, presign.uploadHeaders, file);
      await completeAssetUpload({ assetId: presign.assetId, projectId, storageKey: presign.storageKey });
      setAssetStatus(presign.assetId, "ready");
      return presign.assetId;
    } catch (error) {
      if (nextAssetId) {
        setAssetStatus(nextAssetId, "failed", error instanceof Error ? error.message : "上传失败，请重试。");
      }
      return null;
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const first = files.item(0);
    if (!first) return;
    await uploadOne(first);
  }

  return (
    <div className="grid min-h-full grid-cols-1 gap-4 p-4 pb-28 xl:grid-cols-[1fr_360px]">
      <Tabs>
        <div className="flex items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger active={activeTab === "assets"} onClick={() => setActiveTab("assets")}>
              资产库
            </TabsTrigger>
            <TabsTrigger active={activeTab === "tasks"} onClick={() => setActiveTab("tasks")}>
              任务列表
            </TabsTrigger>
          </TabsList>
          <Button
            onClick={() => {
              fileInputRef.current?.click();
            }}
            type="button"
          >
            <Upload className="size-4" aria-hidden="true" />
            上传素材
          </Button>
          <input
            accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime,audio/mpeg,audio/wav"
            className="hidden"
            onChange={(event) => {
              void handleFiles(event.target.files);
              event.target.value = "";
            }}
            ref={fileInputRef}
            type="file"
          />
        </div>

        {activeTab === "assets" ? (
          <TabsContent>
            <Table className="min-w-[860px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">缩略图</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>大小</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>引用次数</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="w-24">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.map((asset) => (
                  <TableRow key={asset.id}>
                    <TableCell>
                      <AssetIcon asset={asset} />
                    </TableCell>
                    <TableCell className="font-medium">{asset.label}</TableCell>
                    <TableCell className="text-muted-foreground">{asset.fileType}</TableCell>
                    <TableCell className="text-muted-foreground">{asset.sizeLabel}</TableCell>
                    <TableCell>
                      {asset.status === "ready" ? (
                        <Badge tone="success">已完成</Badge>
                      ) : asset.status === "uploading" ? (
                        <Badge tone="warning">上传中</Badge>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Badge tone="danger">失败</Badge>
                          <span className="text-xs text-muted-foreground">{asset.uploadError ?? "上传失败，请重试。"}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{asset.references}</TableCell>
                    <TableCell className="text-muted-foreground">{asset.createdAt}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {asset.status === "failed" ? (
                          <Tooltip label="重试上传">
                            <Button
                              aria-label="重试上传"
                              className="h-8 px-2"
                              onClick={() => {
                                const file = retryFiles[asset.id];
                                if (!file) {
                                  fileInputRef.current?.click();
                                  return;
                                }
                                void (async () => {
                                  const nextId = await uploadOne(file);
                                  if (nextId) removeAsset(asset.id);
                                })();
                              }}
                              type="button"
                              variant="ghost"
                            >
                              重试
                            </Button>
                          </Tooltip>
                        ) : null}
                        <IconAction label="查看资产">
                          <Eye className="size-4" aria-hidden="true" />
                        </IconAction>
                        <IconAction danger label="删除资产">
                          <Trash2 className="size-4" aria-hidden="true" />
                        </IconAction>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>
        ) : (
          <TabsContent>
            <Table className="min-w-[920px]">
              <TableHeader>
                <TableRow>
                  <TableHead>提示词摘要</TableHead>
                  <TableHead>模型</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>费用</TableHead>
                  <TableHead>时间</TableHead>
                  <TableHead className="w-44">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="max-w-72">
                      <span className="line-clamp-1">{task.promptText}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">Seedance 2.0</TableCell>
                    <TableCell>
                      <StatusBadge status={task.status} />
                    </TableCell>
                    <TableCell>
                      <Badge tone="warning">¥{(task.estimatedCostCents / 100).toFixed(2)}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">今天</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <IconAction label="查看任务">
                          <Eye className="size-4" aria-hidden="true" />
                        </IconAction>
                        <IconAction label="重新编辑">
                          <PenLine className="size-4" aria-hidden="true" />
                        </IconAction>
                        <IconAction label="复制参数">
                          <Copy className="size-4" aria-hidden="true" />
                        </IconAction>
                        <IconAction danger label="删除任务">
                          <Trash2 className="size-4" aria-hidden="true" />
                        </IconAction>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>
        )}
      </Tabs>

      <Drawer>
        <DrawerHeader>
          <DrawerTitle>任务详情</DrawerTitle>
          <IconAction label="关闭详情">
            <PanelRightClose className="size-4" aria-hidden="true" />
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
            <p className="rounded-card bg-muted p-3 leading-6">{selectedTask?.promptText}</p>
          </section>
          <section>
            <p className="mb-2 text-xs uppercase text-muted-foreground">参数快照</p>
            <div className="grid grid-cols-2 gap-2">
              {["Seedance 2.0", "全能参考", "16:9", "1080P", "15s", "¥8.60"].map((item) => (
                <Badge className="justify-center py-2" key={item}>
                  {item}
                </Badge>
              ))}
            </div>
          </section>
          <section>
            <p className="mb-2 text-xs uppercase text-muted-foreground">引用资产</p>
            <div className="flex gap-2">
              {assets.map((asset) => (
                <AssetIcon asset={asset} key={asset.id} />
              ))}
            </div>
          </section>
        </DrawerBody>
      </Drawer>
    </div>
  );
}
