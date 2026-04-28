import { useState, type ReactNode } from "react";
import { Copy, Eye, Film, PanelRightClose, PenLine, Trash2, Upload } from "lucide-react";
import { AssetIcon } from "@/components/domain/asset-icon";
import { StatusBadge } from "@/components/domain/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerBody, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useComposerStore } from "@/lib/stores/composer-store";

type AssetTab = "assets" | "tasks";

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
  const selectedTask = tasks[0];

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
          <Button type="button">
            <Upload className="size-4" aria-hidden="true" />
            上传素材
          </Button>
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
                    <TableCell>{asset.references}</TableCell>
                    <TableCell className="text-muted-foreground">{asset.createdAt}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
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
