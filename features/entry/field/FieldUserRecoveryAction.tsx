"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { Check, Copy, KeyRound, Share2 } from "lucide-react";
import {
  resetFieldResidentAccess,
  type FieldResetAccessResult,
} from "@/features/entry/field/residentAccessActions";
import {
  canSendResidentResetEmail,
  canUseResidentRecoveryCode,
  type FieldResident,
} from "@/features/entry/field/peopleModel";

type FieldUserRecoveryActionProps = {
  communityId: string;
  isReadOnlyPreview: boolean;
  user: FieldResident;
};

function subscribe() {
  return () => {};
}

function getShareSnapshot() {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

function getServerSnapshot() {
  return false;
}

function buildRecoveryMessage(input: {
  code: string;
  expiresAt?: string | null;
  userName: string;
}) {
  return [
    `ENTRY temporary access PIN for ${input.userName}: ${input.code}`,
    input.expiresAt ? `Expires: ${input.expiresAt}` : "",
    "Use it now. It may not be shown again.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function FieldUserRecoveryAction({
  communityId,
  isReadOnlyPreview,
  user,
}: FieldUserRecoveryActionProps) {
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<FieldResetAccessResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const canShare = useSyncExternalStore(subscribe, getShareSnapshot, getServerSnapshot);

  const resetMode = canSendResidentResetEmail(user)
    ? "email"
    : canUseResidentRecoveryCode(user)
      ? "recovery_code"
      : "unsupported";

  const recoveryMessage = result?.code
    ? buildRecoveryMessage({
        code: result.code,
        expiresAt: result.expiresAt,
        userName: user.fullName,
      })
    : "";

  function handleReset() {
    setMessage(null);
    setResult(null);

    startTransition(async () => {
      const nextResult = await resetFieldResidentAccess({
        communityId,
        userId: user.userId,
      });

      if (!nextResult.success) {
        setMessage(nextResult.error || "Could not reset access.");
        setResult(nextResult);
        return;
      }

      setConfirming(false);
      setResult(nextResult);
      setMessage(
        nextResult.mode === "email"
          ? "Password reset email sent."
          : "Temporary access PIN generated.",
      );
    });
  }

  async function handleCopy() {
    if (!recoveryMessage) return;

    try {
      await navigator.clipboard.writeText(recoveryMessage);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setMessage("Could not copy the temporary access PIN.");
    }
  }

  async function handleShare() {
    if (!recoveryMessage) return;

    try {
      await navigator.share({
        text: recoveryMessage,
        title: "ENTRY temporary access PIN",
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setMessage("Could not share the temporary access PIN.");
    }
  }

  return (
    <section className="space-y-3" aria-labelledby="field-user-recovery-title">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--console-accent)]">
          Access recovery
        </p>
        <h2 id="field-user-recovery-title" className="sr-only">
          Reset account access
        </h2>
      </div>

      <div className="space-y-3 rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--console-accent-border)] bg-[var(--console-accent-subtle)]">
            <KeyRound aria-hidden="true" className="h-5 w-5 text-[var(--console-accent)]" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-[var(--console-text)]">Reset access</h3>
            {resetMode === "email" ? (
              <p className="mt-1 break-words text-sm leading-6 text-[var(--console-text-muted)]">
                Send a password reset email to {user.email}.
              </p>
            ) : resetMode === "recovery_code" ? (
              <p className="mt-1 text-sm leading-6 text-[var(--console-text-muted)]">
                Generate a temporary six-digit PIN for this username-only {user.role.toLowerCase()} account. The PIN expires after 24 hours.
              </p>
            ) : (
              <p className="mt-1 text-sm leading-6 text-[var(--console-text-muted)]">
                This account does not support access recovery from Field.
              </p>
            )}
          </div>
        </div>

        {message ? (
          <p className="rounded-lg border border-[var(--console-border)] bg-white/[0.03] p-3 text-sm leading-6 text-[var(--console-text-muted)]">
            {message}
          </p>
        ) : null}

        {resetMode !== "unsupported" && !confirming && !result?.code ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={isPending || isReadOnlyPreview}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-[var(--console-border)] bg-white/5 px-4 text-sm font-semibold text-[var(--console-text)] hover:bg-white/10 disabled:opacity-50"
          >
            <KeyRound aria-hidden="true" className="h-4 w-4" />
            {resetMode === "email" ? "Send password reset email" : "Generate temporary PIN"}
          </button>
        ) : null}

        {confirming ? (
          <div className="space-y-3 rounded-lg border border-amber-300/30 bg-amber-300/10 p-3">
            <p className="text-sm leading-6 text-amber-100">
              Confirm access reset for {user.fullName}.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={isPending}
                className="min-h-11 rounded-lg border border-white/15 px-3 text-sm font-semibold text-[var(--console-text)] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReset}
                disabled={isPending || isReadOnlyPreview}
                className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-amber-300 px-3 text-sm font-black text-slate-950 disabled:opacity-50"
              >
                <Check aria-hidden="true" className="h-4 w-4" />
                {isPending ? "Working..." : "Confirm"}
              </button>
            </div>
          </div>
        ) : null}

        {result?.code ? (
          <div className="space-y-3 rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200">
                Temporary PIN
              </p>
              <p className="mt-2 font-mono text-3xl font-black tracking-[0.22em] text-white">
                {result.code}
              </p>
              {result.expiresAt ? (
                <p className="mt-2 text-xs text-emerald-100/80">Expires: {result.expiresAt}</p>
              ) : null}
            </div>
            <div className={`grid gap-2 ${canShare ? "grid-cols-2" : "grid-cols-1"}`}>
              <button
                type="button"
                onClick={handleCopy}
                className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-emerald-200/20 bg-black/10 px-3 text-sm font-semibold text-emerald-50"
              >
                <Copy aria-hidden="true" className="h-4 w-4" />
                {copied ? "Copied" : "Copy PIN"}
              </button>
              {canShare ? (
                <button
                  type="button"
                  onClick={handleShare}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-emerald-200/20 bg-black/10 px-3 text-sm font-semibold text-emerald-50"
                >
                  <Share2 aria-hidden="true" className="h-4 w-4" />
                  Share PIN
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {isReadOnlyPreview ? (
          <p className="text-xs leading-5 text-amber-200">Preview is read-only. Recovery actions are disabled.</p>
        ) : null}
      </div>
    </section>
  );
}
