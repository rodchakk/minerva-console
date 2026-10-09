import { cn } from "@/lib/supabase/utils";

export type EntryButtonVariant = "primary" | "secondary" | "danger" | "ghost";

export const entryButtonBase =
  "inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-[7px] border px-3 text-xs font-semibold leading-none transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7553FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#2E2936] disabled:cursor-not-allowed disabled:opacity-45";

export const entryButtonVariants: Record<EntryButtonVariant, string> = {
  primary:
    "border-[#120539] bg-[#7553FF] text-white shadow-[0_2px_0_#120539] hover:bg-[#8062FF]",
  secondary:
    "border-[#141119] bg-[#2E2936] text-white shadow-[0_2px_0_#141119] hover:bg-[#342F3D]",
  danger:
    "border-rose-400/20 bg-[#2E2936] text-[#FFB6C1] shadow-[0_2px_0_#141119] hover:bg-rose-500/10",
  ghost:
    "border-transparent bg-transparent text-[#A9A3B2] hover:bg-white/[0.04] hover:text-white",
};

export function entryButtonClass(
  variant: EntryButtonVariant = "secondary",
  className?: string,
) {
  return cn(entryButtonBase, entryButtonVariants[variant], className);
}
