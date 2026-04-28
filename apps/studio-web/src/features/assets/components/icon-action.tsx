import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function IconAction({
  children,
  danger = false,
  disabled = false,
  label,
  onClick
}: {
  children: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  label: string;
  onClick?(): void;
}) {
  return (
    <Tooltip label={label}>
      <Button aria-label={label} className={cn("size-8 px-0", danger && "text-danger")} disabled={disabled} onClick={onClick} type="button" variant="ghost">
        {children}
      </Button>
    </Tooltip>
  );
}
