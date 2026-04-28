import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Tabs({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-4", className)} {...props} />;
}

export function TabsList({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("inline-flex rounded-button border border-border bg-muted p-1", className)} role="tablist" {...props} />;
}

type TabsTriggerProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
};

export const TabsTrigger = forwardRef<HTMLButtonElement, TabsTriggerProps>(function TabsTrigger({ active = false, className, ...props }, ref) {
  return (
    <button
      ref={ref}
      aria-selected={active}
      className={cn(
        "rounded-button px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        active && "bg-primary text-primary-foreground hover:text-primary-foreground",
        className
      )}
      role="tab"
      type="button"
      {...props}
    />
  );
});

export function TabsContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-4", className)} role="tabpanel" {...props} />;
}
