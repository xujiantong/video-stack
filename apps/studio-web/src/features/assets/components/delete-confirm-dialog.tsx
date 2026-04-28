import { Button } from "@/components/ui/button";
import { Dialog, DialogCloseButton, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { PendingDelete } from "./assets-workspace-types";

export function DeleteConfirmDialog({ onConfirm, onOpenChange, pendingDelete }: { onConfirm(): void; onOpenChange(open: boolean): void; pendingDelete: PendingDelete | null }) {
  return (
    <Dialog open={pendingDelete !== null} title="确认删除" onOpenChange={onOpenChange}>
      <DialogHeader>
        <div>
          <DialogTitle>确认删除</DialogTitle>
          <DialogDescription>
            {pendingDelete?.type === "asset"
              ? `删除「${pendingDelete.label}」后，引用它的任务不会再显示该素材。`
              : `删除「${pendingDelete?.label ?? ""}」后，任务列表会移除这条记录。`}
          </DialogDescription>
        </div>
        <DialogCloseButton onClose={() => onOpenChange(false)} />
      </DialogHeader>
      {pendingDelete?.type === "asset" && pendingDelete.references > 0 ? (
        <p className="rounded-card border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
          该资产被引用 {pendingDelete.references} 次，请确认后删除。
        </p>
      ) : null}
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
          取消
        </Button>
        <Button type="button" variant="danger" onClick={onConfirm}>
          删除
        </Button>
      </div>
    </Dialog>
  );
}
