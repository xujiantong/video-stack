import { Copy, Eye, PenLine, Trash2 } from "lucide-react";
import type { GenerationTask } from "@video-stack/shared";
import { StatusBadge } from "@/components/domain/status-badge";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { IconAction } from "./icon-action";

export function TaskTable({
  onCopyParameters,
  onDelete,
  onEdit,
  onOpen,
  selectedTaskId,
  tasks
}: {
  onCopyParameters(task: GenerationTask): void;
  onDelete(task: GenerationTask): void;
  onEdit(task: GenerationTask): void;
  onOpen(task: GenerationTask): void;
  selectedTaskId: string | undefined;
  tasks: GenerationTask[];
}) {
  return (
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
          <TableRow key={task.id} className={selectedTaskId === task.id ? "bg-muted/45" : undefined}>
            <TableCell className="max-w-72">
              <span className="line-clamp-1">{task.promptText}</span>
            </TableCell>
            <TableCell className="text-muted-foreground">{task.parameters?.modelId ?? "Seedance 2.0"}</TableCell>
            <TableCell>
              <StatusBadge status={task.status} />
            </TableCell>
            <TableCell>
              <Badge tone="warning">¥{(task.estimatedCostCents / 100).toFixed(2)}</Badge>
            </TableCell>
            <TableCell className="text-muted-foreground">今天</TableCell>
            <TableCell>
              <div className="flex gap-1">
                <IconAction label="查看任务" onClick={() => onOpen(task)}>
                  <Eye className="size-4" aria-hidden="true" />
                </IconAction>
                <IconAction label="重新编辑" onClick={() => onEdit(task)}>
                  <PenLine className="size-4" aria-hidden="true" />
                </IconAction>
                <IconAction label="复制参数" onClick={() => onCopyParameters(task)}>
                  <Copy className="size-4" aria-hidden="true" />
                </IconAction>
                <IconAction danger label="删除任务" onClick={() => onDelete(task)}>
                  <Trash2 className="size-4" aria-hidden="true" />
                </IconAction>
              </div>
            </TableCell>
          </TableRow>
        ))}
        {tasks.length === 0 ? (
          <TableRow>
            <TableCell className="py-10 text-center text-muted-foreground" colSpan={6} role="status">
              没有匹配任务，请调整搜索或筛选条件。
            </TableCell>
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  );
}
