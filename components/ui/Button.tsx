import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/supabase/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

const styles = {
  primary:
    "bg-[var(--primary)] text-white hover:bg-[var(--primary-strong)] disabled:bg-slate-400",
  secondary:
    "bg-white text-slate-900 ring-1 ring-inset ring-[var(--border)] hover:bg-slate-50 disabled:text-slate-400",
  ghost:
    "bg-transparent text-slate-700 hover:bg-slate-100 disabled:text-slate-400",
  danger: "bg-[var(--danger)] text-white hover:bg-rose-700 disabled:bg-slate-400",
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
