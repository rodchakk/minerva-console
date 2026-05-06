import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/supabase/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

const styles = {
  primary:
    "bg-[var(--primary)] text-white shadow-[0_12px_30px_rgba(89,80,243,0.28)] hover:bg-[var(--primary-strong)] disabled:bg-slate-500",
  secondary:
    "bg-white/6 text-[var(--foreground)] ring-1 ring-inset ring-[var(--border)] hover:bg-white/10 disabled:text-slate-500",
  ghost:
    "bg-transparent text-[var(--text-soft)] hover:bg-white/6 hover:text-white disabled:text-slate-500",
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
        "inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed",
        styles[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
