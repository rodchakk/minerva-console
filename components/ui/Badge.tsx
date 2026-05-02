import type { ReactNode } from "react";
import { cn } from "@/lib/supabase/utils";

type BadgeProps = {
  children: ReactNode;
  tone?: "default" | "success" | "warning" | "danger" | "info";
};

const tones = {
  default: "bg-slate-100 text-slate-700",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-rose-100 text-rose-700",
  info: "bg-cyan-100 text-cyan-700",
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
