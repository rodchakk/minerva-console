"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  Building2,
  Clipboard,
  ClipboardCheck,
  KeyRound,
  Loader2,
  UserRound,
  X,
} from "lucide-react";
import {
  resetEntrySupportRequesterAccess,
  type SupportResetRequesterAccessState,
} from "@/features/entry/support/actions";
import { cn } from "@/lib/supabase/utils";

type DiagnosticRow = {
  label: string;
  value: string;
};

type SupportQuickToolsProps = {
  communityHref: string | null;
  diagnostics: DiagnosticRow[];
  requesterName: string;
  resetDisabledReason?: string;
  residentHref: string | null;
  ticketId: string;
};

function formatExpiration(expiresAt?: string | null) {
  if (!expiresAt) return "";

  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return expiresAt;

  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function toolClass(disabled?: boolean) {
  return cn(
    "flex min-h-9 w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--console-accent)]/50",
    disabled
      ? "cursor-not-allowed border-[var(--console-border)] bg-white/[0.01] text-[var(--console-text-soft)]"
      : "border-[var(--console-border-strong)] bg-white/[0.025] text-slate-100 hover:border-white/20 hover:bg-white/[0.05] hover:text-white",
  );
}

function ResetSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-transparent bg-[var(--console-accent)] px-3.5 text-xs font-semibold text-white transition hover:bg-[var(--console-accent-hover)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--console-accent)]/50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin stroke-[1.75]" /> : null}
      {pending ? "Resetting..." : "Reset password"}
    </button>
  );
}

function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex h-8 items-center gap-2 rounded-lg border border-[var(--console-border-strong)] bg-white/[0.025] px-2.5 text-xs font-semibold text-slate-100 transition hover:border-white/20 hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--console-accent)]/50"
    >
      {copied ? (
        <ClipboardCheck className="h-3.5 w-3.5 stroke-[1.75] text-emerald-300" />
      ) : (
        <Clipboard className="h-3.5 w-3.5 stroke-[1.75]" />
      )}
      {copied ? "Copied" : "Copy code"}
    </button>
  );
}

function ResetResult({ state }: { state: SupportResetRequesterAccessState }) {
  const expiration = useMemo(() => formatExpiration(state.expiresAt), [state.expiresAt]);

  if (state.success && state.mode === "email") {
    return (
      <p className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3.5 py-2.5 text-xs font-medium text-emerald-200">
        Password reset email sent.
      </p>
    );
  }

  if (state.success && state.mode === "recovery_code" && state.code) {
    return (
      <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 p-3.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-300/80">
          Temporary recovery code
        </p>
        <p className="mt-1 select-all font-mono text-base font-semibold text-emerald-100">
          {state.code}
        </p>
        {expiration ? (
          <p className="mt-1 text-[11px] text-emerald-200/80">
            Expires: {expiration}
          </p>
        ) : null}
        <div className="mt-2.5">
          <CopyCodeButton code={state.code} />
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <p className="rounded-lg border border-rose-400/20 bg-rose-500/10 px-3.5 py-2.5 text-xs font-medium text-rose-200">
        {state.error}
      </p>
    );
  }

  return null;
}

export function SupportQuickTools({
  communityHref,
  diagnostics,
  requesterName,
  resetDisabledReason,
  residentHref,
  ticketId,
}: SupportQuickToolsProps) {
  const [resetState, resetAction] = useActionState(
    resetEntrySupportRequesterAccess,
    {},
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [diagnosticsCopied, setDiagnosticsCopied] = useState(false);
  const diagnosticsText = useMemo(
    () => diagnostics.map((row) => `${row.label}: ${row.value}`).join("\n"),
    [diagnostics],
  );

  const copyDiagnostics = async () => {
    try {
      await navigator.clipboard.writeText(diagnosticsText);
      setDiagnosticsCopied(true);
      window.setTimeout(() => setDiagnosticsCopied(false), 1800);
    } catch {
      setDiagnosticsCopied(false);
    }
  };

  return (
    <>
      <div className="space-y-2.5">
        <button
          type="button"
          disabled={Boolean(resetDisabledReason)}
          title={resetDisabledReason}
          className={toolClass(Boolean(resetDisabledReason))}
          onClick={() => setConfirmOpen(true)}
        >
          <KeyRound className="h-4 w-4 shrink-0 stroke-[1.75]" />
          <span className="min-w-0 flex-1">Reset password</span>
        </button>

        {residentHref ? (
          <Link href={residentHref} className={toolClass()}>
            <UserRound className="h-4 w-4 shrink-0 stroke-[1.75]" />
            <span className="min-w-0 flex-1">View resident</span>
          </Link>
        ) : (
          <span className={toolClass(true)}>
            <UserRound className="h-4 w-4 shrink-0 stroke-[1.75]" />
            <span className="min-w-0 flex-1">View resident</span>
          </span>
        )}

        {communityHref ? (
          <Link href={communityHref} className={toolClass()}>
            <Building2 className="h-4 w-4 shrink-0 stroke-[1.75]" />
            <span className="min-w-0 flex-1">View community</span>
          </Link>
        ) : (
          <span className={toolClass(true)}>
            <Building2 className="h-4 w-4 shrink-0 stroke-[1.75]" />
            <span className="min-w-0 flex-1">View community</span>
          </span>
        )}

        <button
          type="button"
          disabled={!diagnosticsText}
          className={toolClass(!diagnosticsText)}
          onClick={copyDiagnostics}
        >
          {diagnosticsCopied ? (
            <ClipboardCheck className="h-4 w-4 shrink-0 stroke-[1.75] text-emerald-300" />
          ) : (
            <Clipboard className="h-4 w-4 shrink-0 stroke-[1.75]" />
          )}
          <span className="min-w-0 flex-1">
            {diagnosticsCopied ? "Diagnostics copied" : "Copy diagnostics"}
          </span>
        </button>
      </div>

      <ResetResult state={resetState} />

      {confirmOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="support-reset-title"
            className="w-full max-w-sm rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="support-reset-title" className="text-base font-semibold text-white">
                  Reset password?
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--console-text-muted)]">
                  Send password recovery for <span className="text-white">{requesterName}</span>?
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[var(--console-border-strong)] bg-white/[0.025] text-[var(--console-text-muted)] transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--console-accent)]/50"
                onClick={() => setConfirmOpen(false)}
              >
                <X className="h-4 w-4 stroke-[1.75]" />
              </button>
            </div>

            <form
              action={resetAction}
              className="mt-5 flex items-center justify-end gap-2"
              onSubmit={() => setConfirmOpen(false)}
            >
              <input type="hidden" name="ticketId" value={ticketId} />
              <button
                type="button"
                className="inline-flex h-9 items-center justify-center rounded-lg border border-[var(--console-border-strong)] bg-white/[0.025] px-3.5 text-xs font-semibold text-slate-100 transition hover:border-white/20 hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--console-accent)]/50"
                onClick={() => setConfirmOpen(false)}
              >
                Cancel
              </button>
              <ResetSubmitButton />
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
