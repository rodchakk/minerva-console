import type { ReactNode } from "react";
import { cn } from "@/lib/supabase/utils";

type BadgeProps = {
  children: ReactNode;
  tone?: "default" | "success" | "warning" | "danger" | "info";
};

const tones = {
  default: "bg-white/8 text-slate-200 ring-1 ring-inset ring-white/8",
  success: "bg-emerald-500/12 text-emerald-300 ring-1 ring-inset ring-emerald-400/20",
  warning: "bg-amber-500/12 text-amber-300 ring-1 ring-inset ring-amber-400/20",
  danger: "bg-rose-500/12 text-rose-300 ring-1 ring-inset ring-rose-400/20",
  info: "bg-violet-500/12 text-violet-200 ring-1 ring-inset ring-violet-400/20",
};

export function Badge({ children, tone = "default" }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
