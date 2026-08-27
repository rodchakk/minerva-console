"use client";

import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { Copy, KeyRound, Share2 } from "lucide-react";
import {
  generateFieldActivationPin,
  type FieldActivationPinResult,
} from "@/features/entry/field/peopleActions";
import {
  isActivationPinEligible,
  type FieldActivationRow,
} from "@/features/entry/field/peopleModel";

type FieldActivationActionsProps = {
  communityId: string;
  communityName: string;
  isReadOnlyPreview: boolean;
  row: FieldActivationRow;
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

function buildActivationMessage(input: {
  communityName: string;
  pin: string;
  residentName: string;
  unitLabel?: string | null;
  username?: string | null;
}) {
  return [
    `ENTRY activation for ${input.residentName}`,
    `Community: ${input.communityName}`,
    input.unitLabel ? `Unit: ${input.unitLabel}` : "",
    input.username ? `Username: ${input.username}` : "",
    `Activation PIN: ${input.pin}`,
    "Open ENTRY and enter this PIN to activate your account.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function FieldActivationActions({
  communityId,
  communityName,
  isReadOnlyPreview,
  row,
}: FieldActivationActionsProps) {
  const [confirmingPin, setConfirmingPin] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pinResult, setPinResult] = useState<FieldActivationPinResult | null>(
    null,
  );
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const canShare = useSyncExternalStore(
    subscribe,
    getShareSnapshot,
    getServerSnapshot,
  );
  const pinEligible = isActivationPinEligible(row);
  const activationMessage = useMemo(() => {
    if (!pinResult?.pin) {
      return "";
    }

    return buildActivationMessage({
      communityName,
      pin: pinResult.pin,
      residentName: pinResult.residentName || row.resident,
      unitLabel: pinResult.unitLabel || row.unit,
      username: pinResult.suggestedUsername,
    });
  }, [communityName, pinResult, row.resident, row.unit]);

  function handleGeneratePin() {
    setMessage(null);
    setPinResult(null);

    startTransition(async () => {
      const result = await generateFieldActivationPin({
        communityId,
        queueId: row.id,
      });

      if (!result.success) {
        setMessage(result.error || "Could not generate activation PIN.");
        setPinResult(result);
        return;
      }

      setConfirmingPin(false);
      setPinResult(result);
      setMessage("Activation PIN generated.");
    });
  }

  async function handleCopy() {
    if (!activationMessage) return;

    try {
      await navigator.clipboard.writeText(activationMessage);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setMessage("Could not copy activation message.");
    }
  }

  async function handleShare() {
    if (!activationMessage) return;

    try {
      await navigator.share({
        text: activationMessage,
        title: "ENTRY activation PIN",
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      setMessage("Could not share activation PIN.");
    }
  }

  return (
    <div className="space-y-4">
      {message ? (
        <p className="rounded-lg border border-[var(--console-border)] bg-white/[0.03] p-3 text-sm leading-6 text-[var(--console-text-muted)]">
          {message}
        </p>
      ) : null}

      <section className="space-y-3 rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
        <div className="flex items-center gap-2">
          <KeyRound
            aria-hidden="true"
            className="h-4 w-4 text-[var(--console-accent)]"
          />
          <h2 className="text-lg font-semibold text-[var(--console-text)]">
            Generate activation PIN
          </h2>
        </div>

        <p className="break-words text-sm leading-6 text-[var(--console-text-muted)]">
          Generate a single activation PIN for {row.resident} in {row.unit}.
          The PIN will be shown once after confirmation.
        </p>

        {isReadOnlyPreview ? (
          <p className="text-xs leading-5 text-amber-200">
            Preview is read-only. PIN generation is disabled.
          </p>
        ) : null}

        {!pinEligible ? (
          <p className="rounded-lg border border-[var(--console-border)] bg-white/[0.03] p-3 text-sm leading-6 text-[var(--console-text-muted)]">
            This activation row is not eligible for a new PIN.
          </p>
        ) : !confirmingPin ? (
          <button
            type="button"
            onClick={() => setConfirmingPin(true)}
            disabled={isPending || isReadOnlyPreview}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[var(--console-accent)] px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <KeyRound aria-hidden="true" className="h-4 w-4" />
            Generate activation PIN
          </button>
        ) : (
          <div className="space-y-3 rounded-lg border border-amber-300/30 bg-amber-300/10 p-3">
            <p className="break-words text-sm leading-6 text-amber-100">
              Confirm PIN generation for {row.resident} in {row.unit}.
            </p>
            <button
              type="button"
              onClick={handleGeneratePin}
              disabled={isPending || isReadOnlyPreview}
              className="min-h-12 w-full rounded-lg bg-amber-300 px-4 text-sm font-black text-slate-950 transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isPending ? "Generating..." : "Confirm PIN generation"}
            </button>
          </div>
        )}

        {pinResult?.pin ? (
          <div className="space-y-3 rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-3">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-100">
              Activation PIN
            </p>
            <p className="break-all font-mono text-3xl font-semibold text-white">
              {pinResult.pin}
            </p>
            <p className="text-sm leading-6 text-emerald-100">
              Copy or share this now. It may not be shown again.
            </p>
            <button
              type="button"
              onClick={handleCopy}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-black text-slate-950"
            >
              <Copy aria-hidden="true" className="h-4 w-4" />
              {copied ? "Copied" : "Copy activation message"}
            </button>
            {canShare ? (
              <button
                type="button"
                onClick={handleShare}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-emerald-200/60 px-4 text-sm font-semibold text-white"
              >
                <Share2 aria-hidden="true" className="h-4 w-4" />
                Share activation message
              </button>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-4">
        <h2 className="text-lg font-semibold text-amber-100">
          Create account now
        </h2>
        <p className="mt-2 text-sm leading-6 text-amber-100">
          Blocked for Field: the current completion RPC activates by PIN only and
          does not accept a queue id, so Field cannot prove the selected row is
          the row completed after PIN generation without a reviewed backend
          change.
        </p>
      </section>
    </div>
  );
}
