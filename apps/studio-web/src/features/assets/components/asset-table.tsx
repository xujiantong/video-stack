import { Eye, Trash2 } from "lucide-react";
import { AssetIcon } from "@/components/domain/asset-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip } from "@/components/ui/tooltip";
import type { StudioAsset } from "@/lib/stores/composer-store";
import { IconAction } from "./icon-action";

export function AssetTable({
  assets,
  onDelete,
  onView,
  onRetry,
  retryFiles
}: {
  assets: StudioAsset[];
  onDelete(asset: StudioAsset): void;
  onView(asset: StudioAsset): void;
  onRetry(asset: StudioAsset): void;
  retryFiles: Record<string, File>;
}) {
  return (
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
                  <Tooltip label={retryFiles[asset.id] ? "重试上传" : "重新选择文件"}>
                    <Button aria-label="重试上传" className="h-8 px-2" onClick={() => onRetry(asset)} type="button" variant="ghost">
                      重试
                    </Button>
                  </Tooltip>
                ) : null}
                <IconAction disabled={!asset.previewUrl} label="查看资产" onClick={() => onView(asset)}>
                  <Eye className="size-4" aria-hidden="true" />
                </IconAction>
                <IconAction danger label="删除资产" onClick={() => onDelete(asset)}>
                  <Trash2 className="size-4" aria-hidden="true" />
                </IconAction>
              </div>
            </TableCell>
          </TableRow>
        ))}
        {assets.length === 0 ? (
          <TableRow>
            <TableCell className="py-10 text-center text-muted-foreground" colSpan={8} role="status">
              没有匹配资产，请调整搜索或筛选条件。
            </TableCell>
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  );
}
