import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Drawer({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <aside className={cn("rounded-card border border-border bg-surface p-4", className)} {...props} />;
}

export function DrawerHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center justify-between gap-3", className)} {...props} />;
}

export function DrawerTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-base font-semibold", className)} {...props} />;
}

export function DrawerBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-4 space-y-4 text-sm", className)} {...props} />;
}
