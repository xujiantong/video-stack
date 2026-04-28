import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Tooltip({ children, className, label }: { children: ReactNode; className?: string; label: string }) {
  const tooltipId = useId();

  return (
    <span className={cn("group relative inline-flex", className)}>
      <span aria-describedby={tooltipId}>{children}</span>
      <span
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-button border border-border bg-surface-raised px-2 py-1 text-xs text-foreground shadow-popover group-focus-within:block group-hover:block"
        id={tooltipId}
        role="tooltip"
      >
        {label}
      </span>
    </span>
  );
}
