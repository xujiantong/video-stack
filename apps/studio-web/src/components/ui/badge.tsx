import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BadgeTone = "muted" | "primary" | "warning" | "danger" | "success";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
};

const toneClass: Record<BadgeTone, string> = {
  muted: "border-border bg-muted text-muted-foreground",
  primary: "border-primary/40 bg-primary/10 text-primary",
  warning: "border-warning/40 bg-warning/10 text-warning",
  danger: "border-danger/40 bg-danger/10 text-danger",
  success: "border-success/40 bg-success/10 text-success"
};

export function Badge({ className, tone = "muted", ...props }: BadgeProps) {
  return <span className={cn("inline-flex w-fit items-center gap-1 rounded-button border px-2 py-1 text-xs", toneClass[tone], className)} {...props} />;
}
