"use client";

import { KeyRound, Mail, Zap } from "lucide-react";

export type ResidentAccessMode = "email" | "pin" | "quick";

type ResidentAccessModePickerProps = {
  value: ResidentAccessMode;
  onChange: (mode: ResidentAccessMode) => void;
  disabled?: Partial<Record<ResidentAccessMode, string>>;
  compact?: boolean;
};

const OPTIONS: Array<{
  value: ResidentAccessMode;
  label: string;
  description: string;
  badge?: string;
  icon: typeof Mail;
}> = [
  {
    value: "email",
    label: "Email invitation",
    description: "Send the normal ENTRY activation email with a 7-day PIN. The resident creates their own password.",
    badge: "Recommended",
    icon: Mail,
  },
  {
    value: "pin",
    label: "Activation PIN",
    description: "Prepare the resident in Activation Queue and generate a PIN to share manually. No email is sent.",
    icon: KeyRound,
  },
  {
    value: "quick",
    label: "Quick create",
    description: "Create an active ENTRY account immediately with a temporary password.",
    icon: Zap,
  },
];

export function ResidentAccessModePicker({
  value,
  onChange,
  disabled = {},
  compact = false,
}: ResidentAccessModePickerProps) {
  return (
    <div className={compact ? "grid gap-2" : "grid gap-2 sm:grid-cols-3"}>
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const disabledReason = disabled[option.value];
        const isDisabled = Boolean(disabledReason);
        const isActive = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            disabled={isDisabled}
            onClick={() => onChange(option.value)}
            aria-pressed={isActive}
            className={`rounded-lg border p-3 text-left transition ${
              isActive
                ? "border-violet-400/45 bg-violet-500/12 ring-1 ring-inset ring-violet-400/15"
                : "border-white/10 bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.045]"
            } disabled:cursor-not-allowed disabled:opacity-45`}
            title={disabledReason}
          >
            <div className="flex items-start gap-2.5">
              <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md ${
                isActive ? "bg-violet-500/18 text-violet-100" : "bg-white/[0.05] text-slate-300"
              }`}>
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-white">{option.label}</p>
                  {option.badge ? (
                    <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-200">
                      {option.badge}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-[11px] leading-4 text-[var(--text-muted)]">
                  {disabledReason ?? option.description}
                </p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
