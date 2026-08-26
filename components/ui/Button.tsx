import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/supabase/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

const styles = {
  primary:
    "border border-transparent bg-[var(--primary)] text-white hover:bg-[var(--primary-strong)] disabled:bg-slate-500",
  secondary:
    "border border-[var(--border)] bg-white/[0.025] text-[var(--foreground)] hover:border-white/20 hover:bg-white/[0.05] disabled:text-slate-500",
  ghost:
    "bg-transparent text-[var(--text-soft)] hover:bg-white/5 hover:text-white disabled:text-slate-500",
  danger: "bg-[var(--danger)] text-white hover:bg-rose-500 disabled:bg-slate-500",
};

export function Button({
  children,
  className,
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed",
        styles[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
