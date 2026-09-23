"use client";

import { KeyRound, Mail, UserPlus } from "lucide-react";

export type ResidentAccessMode = "email" | "pin" | "quick";

type ResidentAccessModePickerProps = {
  value: ResidentAccessMode;
  onChange: (mode: ResidentAccessMode) => void;
  disabled?: Partial<Record<ResidentAccessMode, string>>;
  compact?: boolean;
};

function RadioMark({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden
      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border transition ${
        active
          ? "border-violet-400 bg-violet-500/10"
          : "border-slate-500/70 bg-transparent"
      }`}
    >
      {active ? <span className="h-2.5 w-2.5 rounded-full bg-violet-400" /> : null}
    </span>
  );
}

export function ResidentAccessModePicker({
  value,
  onChange,
  disabled = {},
  compact = false,
}: ResidentAccessModePickerProps) {
  const inviteActive = value === "email" || value === "pin";
  const emailDisabledReason = disabled.email;
  const pinDisabledReason = disabled.pin;
  const quickDisabledReason = disabled.quick;
  const inviteDisabled = Boolean(emailDisabledReason && pinDisabledReason);

  const preferredInviteMode: ResidentAccessMode =
    value === "pin" && !pinDisabledReason
      ? "pin"
      : !emailDisabledReason
        ? "email"
        : "pin";

  const inviteDisabledReason =
    emailDisabledReason && pinDisabledReason
      ? emailDisabledReason === pinDisabledReason
        ? emailDisabledReason
        : "Activation invitation is not available for this user."
      : undefined;

  return (
    <div className="grid gap-3">
      <button
        type="button"
        disabled={Boolean(quickDisabledReason)}
        onClick={() => onChange("quick")}
        aria-pressed={value === "quick"}
        className={`w-full rounded-xl border text-left transition ${
          compact ? "p-3" : "p-4"
        } ${
          value === "quick"
            ? "border-violet-400/80 bg-violet-500/10 ring-1 ring-inset ring-violet-400/20"
            : "border-white/10 bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.045]"
        } disabled:cursor-not-allowed disabled:opacity-45`}
        title={quickDisabledReason}
      >
        <div className="flex items-start gap-3">
          <span
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${
              value === "quick"
                ? "bg-violet-500/18 text-violet-100"
                : "bg-white/[0.05] text-slate-300"
            }`}
          >
            <UserPlus className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white">
              Quick create active user
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
              {quickDisabledReason ??
                "Immediately create an active ENTRY user and generate a temporary password. Use this when activation will be completed from the console."}
            </p>
          </div>
          <RadioMark active={value === "quick"} />
        </div>
      </button>

      <div
        className={`overflow-hidden rounded-xl border transition ${
          inviteActive
            ? "border-violet-400/80 bg-violet-500/10 ring-1 ring-inset ring-violet-400/20"
            : "border-white/10 bg-white/[0.025]"
        } ${inviteDisabled ? "opacity-45" : ""}`}
      >
        <button
          type="button"
          disabled={inviteDisabled}
          onClick={() => onChange(preferredInviteMode)}
          aria-pressed={inviteActive}
          className="w-full p-4 text-left transition hover:bg-white/[0.025] disabled:cursor-not-allowed"
          title={inviteDisabledReason}
        >
          <div className="flex items-start gap-3">
            <span
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${
                inviteActive
                  ? "bg-violet-500/18 text-violet-100"
                  : "bg-white/[0.05] text-slate-300"
              }`}
            >
              <Mail className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">
                Send activation invite
              </p>
              <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                {inviteDisabledReason ??
                  "Create the resident through the standard activation flow and send an email invitation or generate an activation PIN so they can finish setup in the app."}
              </p>
            </div>
            <RadioMark active={inviteActive} />
          </div>
        </button>

        {inviteActive && !inviteDisabled ? (
          <div className="border-t border-white/8 px-4 pb-4 pt-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
              Invitation method
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={Boolean(emailDisabledReason)}
                onClick={() => onChange("email")}
                aria-pressed={value === "email"}
                title={emailDisabledReason}
                className={`rounded-lg border px-3 py-2.5 text-left transition ${
                  value === "email"
                    ? "border-violet-400/55 bg-violet-500/12"
                    : "border-white/10 bg-black/10 hover:border-white/20"
                } disabled:cursor-not-allowed disabled:opacity-45`}
              >
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-violet-200" aria-hidden />
                  <span className="text-xs font-semibold text-white">
                    Email invitation
                  </span>
                  {!emailDisabledReason ? (
                    <span className="ml-auto rounded-full border border-emerald-400/20 bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.1em] text-emerald-200">
                      Recommended
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-[10px] leading-4 text-[var(--text-muted)]">
                  {emailDisabledReason ??
                    "Send the normal ENTRY activation email. The resident creates their own password."}
                </p>
              </button>

              <button
                type="button"
                disabled={Boolean(pinDisabledReason)}
                onClick={() => onChange("pin")}
                aria-pressed={value === "pin"}
                title={pinDisabledReason}
                className={`rounded-lg border px-3 py-2.5 text-left transition ${
                  value === "pin"
                    ? "border-violet-400/55 bg-violet-500/12"
                    : "border-white/10 bg-black/10 hover:border-white/20"
                } disabled:cursor-not-allowed disabled:opacity-45`}
              >
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-violet-200" aria-hidden />
                  <span className="text-xs font-semibold text-white">
                    Activation PIN
                  </span>
                </div>
                <p className="mt-1 text-[10px] leading-4 text-[var(--text-muted)]">
                  {pinDisabledReason ??
                    "Generate a PIN to share manually. No invitation email is sent."}
                </p>
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
