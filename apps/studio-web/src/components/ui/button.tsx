import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground shadow-[0_0_0_1px_hsl(183_78%_52%/0.22)] hover:brightness-110",
  secondary: "border border-border bg-muted text-foreground hover:border-primary/70 hover:bg-surface-raised",
  ghost: "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
  danger: "bg-danger text-foreground hover:brightness-110"
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
