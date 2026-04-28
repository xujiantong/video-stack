import { X } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

type DialogProps = {
  children: ReactNode;
  open: boolean;
  title: string;
  onOpenChange(open: boolean): void;
};

export function Dialog({ children, open, title, onOpenChange }: DialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4" role="presentation" onMouseDown={() => onOpenChange(false)}>
      <section
        aria-label={title}
        aria-modal="true"
        className="w-full max-w-lg rounded-popover border border-border bg-surface p-4 shadow-popover"
        role="dialog"
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === "Escape") onOpenChange(false);
        }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {children}
      </section>
    </div>
  );
}

export function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4 flex items-start justify-between gap-4", className)} {...props} />;
}

export function DialogTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-base font-semibold", className)} {...props} />;
}

export function DialogDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mt-1 text-sm text-muted-foreground", className)} {...props} />;
}

export function DialogCloseButton({ onClose }: { onClose(): void }) {
  return (
    <Button aria-label="关闭弹窗" className="size-8 shrink-0 px-0" type="button" variant="ghost" onClick={onClose}>
      <X className="size-4" aria-hidden="true" />
    </Button>
  );
}
