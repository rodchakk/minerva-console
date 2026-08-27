"use client";

import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, House, KeyRound, Share2 } from "lucide-react";
import {
  assignFieldResidentToUnit,
  resetFieldResidentAccess,
  type FieldResetAccessResult,
} from "@/features/entry/field/peopleActions";
import {
  canSendResidentResetEmail,
  canUseResidentRecoveryCode,
  getFieldResidentAssignmentUnits,
  type FieldResident,
  type FieldUnit,
} from "@/features/entry/field/peopleModel";

type FieldResidentActionsProps = {
  communityId: string;
  isReadOnlyPreview: boolean;
  resident: FieldResident;
  unitState: "ready" | "unavailable";
  units: FieldUnit[];
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
  residentName: string;
}) {
  return [
    `ENTRY temporary recovery code for ${input.residentName}: ${input.code}`,
    input.expiresAt ? `Expires: ${input.expiresAt}` : "",
    "Use it now. It may not be shown again.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function FieldResidentActions({
  communityId,
  isReadOnlyPreview,
  resident,
  unitState,
  units,
}: FieldResidentActionsProps) {
  const router = useRouter();
  const [selectedUnitId, setSelectedUnitId] = useState(resident.houseId);
  const [confirmingMove, setConfirmingMove] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<FieldResetAccessResult | null>(
    null,
  );
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const canShare = useSyncExternalStore(
    subscribe,
    getShareSnapshot,
    getServerSnapshot,
  );

  const assignmentUnits = useMemo(
    () => getFieldResidentAssignmentUnits(units, resident.houseId),
    [resident.houseId, units],
  );
  const selectedUnit = useMemo(
    () => assignmentUnits.find((unit) => unit.id === selectedUnitId) ?? null,
    [assignmentUnits, selectedUnitId],
  );
  const canMove = Boolean(
    selectedUnit?.isActive &&
      selectedUnitId &&
      selectedUnitId !== resident.houseId,
  );
  const resetMode = canSendResidentResetEmail(resident)
    ? "email"
    : canUseResidentRecoveryCode(resident)
      ? "recovery_code"
      : "unsupported";
  const recoveryMessage =
    resetResult?.code
      ? buildRecoveryMessage({
          code: resetResult.code,
          expiresAt: resetResult.expiresAt,
          residentName: resident.fullName,
        })
      : "";

  function handleMove() {
    if (!selectedUnitId) return;
    setMessage(null);

    startTransition(async () => {
      const result = await assignFieldResidentToUnit({
        communityId,
        unitId: selectedUnitId,
        userId: resident.userId,
      });

      if (!result.success) {
        setMessage(result.error || "Could not change unit.");
        return;
      }

      setConfirmingMove(false);
      setMessage("Unit assignment updated.");
      router.refresh();
    });
  }

  function handleReset() {
    setMessage(null);
    setResetResult(null);

    startTransition(async () => {
      const result = await resetFieldResidentAccess({
        communityId,
        userId: resident.userId,
      });

      if (!result.success) {
        setMessage(result.error || "Could not reset access.");
        setResetResult(result);
        return;
      }

      setConfirmingReset(false);
      setResetResult(result);
      setMessage(
        result.mode === "email"
          ? "Password reset email sent."
          : "Temporary recovery code generated.",
      );
    });
  }

  async function handleCopyRecovery() {
    if (!recoveryMessage) return;

    try {
      await navigator.clipboard.writeText(recoveryMessage);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setMessage("Could not copy recovery code.");
    }
  }

  async function handleShareRecovery() {
    if (!recoveryMessage) return;

    try {
      await navigator.share({
        text: recoveryMessage,
        title: "ENTRY recovery code",
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      setMessage("Could not share recovery code.");
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
          <House
            aria-hidden="true"
            className="h-4 w-4 text-[var(--console-accent)]"
          />
          <h2 className="text-lg font-semibold text-[var(--console-text)]">
            Change unit
          </h2>
        </div>
        {unitState === "unavailable" ? (
          <p className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-3 text-sm leading-6 text-amber-100">
            Unit list unavailable.
          </p>
        ) : (
          <select
            value={selectedUnitId}
            onChange={(event) => {
              setSelectedUnitId(event.target.value);
              setConfirmingMove(false);
            }}
            disabled={isReadOnlyPreview || isPending}
            className="min-h-12 w-full rounded-lg border border-[var(--console-border)] bg-black/20 px-3 text-base text-[var(--console-text)] outline-none focus:border-[var(--console-accent)] disabled:opacity-60"
          >
            <option value="">Select unit</option>
            {assignmentUnits.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.label}
                {!unit.isActive && unit.id === resident.houseId
                  ? " (current, inactive)"
                  : ""}
              </option>
            ))}
          </select>
        )}

        {isReadOnlyPreview ? (
          <p className="text-xs leading-5 text-amber-200">
            Preview is read-only. Unit changes are disabled.
          </p>
        ) : null}

        {!confirmingMove ? (
          <button
            type="button"
            onClick={() => setConfirmingMove(true)}
            disabled={
              !canMove || isPending || isReadOnlyPreview || unitState !== "ready"
            }
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[var(--console-accent)] px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Check aria-hidden="true" className="h-4 w-4" />
            Continue
          </button>
        ) : (
          <div className="space-y-3 rounded-lg border border-amber-300/30 bg-amber-300/10 p-3">
            <p className="text-sm leading-6 text-amber-100">
              Move {resident.fullName} from {resident.houseLabel} to{" "}
              {selectedUnit?.label ?? "the selected unit"}?
            </p>
            <button
              type="button"
              onClick={handleMove}
              disabled={isPending || isReadOnlyPreview || !canMove}
              className="min-h-12 w-full rounded-lg bg-amber-300 px-4 text-sm font-black text-slate-950 transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isPending ? "Saving..." : "Confirm unit change"}
            </button>
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
        <div className="flex items-center gap-2">
          <KeyRound
            aria-hidden="true"
            className="h-4 w-4 text-[var(--console-accent)]"
          />
          <h2 className="text-lg font-semibold text-[var(--console-text)]">
            Reset access
          </h2>
        </div>

        {resetMode === "email" ? (
          <p className="break-words text-sm leading-6 text-[var(--console-text-muted)]">
            A password reset email will be sent to {resident.email}.
          </p>
        ) : resetMode === "recovery_code" ? (
          <p className="text-sm leading-6 text-[var(--console-text-muted)]">
            Generate a temporary recovery code. It will be shown once after
            confirmation.
          </p>
        ) : (
          <p className="text-sm leading-6 text-[var(--console-text-muted)]">
            This account does not support the resident recovery flow from Field.
          </p>
        )}

        {isReadOnlyPreview ? (
          <p className="text-xs leading-5 text-amber-200">
            Preview is read-only. Reset access is disabled.
          </p>
        ) : null}

        {resetMode !== "unsupported" && !confirmingReset ? (
          <button
            type="button"
            onClick={() => setConfirmingReset(true)}
            disabled={isPending || isReadOnlyPreview}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-[var(--console-border)] bg-white/5 px-4 text-sm font-semibold text-[var(--console-text)] transition-colors hover:bg-white/10 disabled:opacity-50"
          >
            <KeyRound aria-hidden="true" className="h-4 w-4" />
            {resetMode === "email"
              ? "Send password reset email"
              : "Generate recovery code"}
          </button>
        ) : null}

        {confirmingReset ? (
          <div className="space-y-3 rounded-lg border border-amber-300/30 bg-amber-300/10 p-3">
            <p className="text-sm leading-6 text-amber-100">
              Confirm reset access for {resident.fullName}.
            </p>
            <button
              type="button"
              onClick={handleReset}
              disabled={isPending || isReadOnlyPreview}
              className="min-h-12 w-full rounded-lg bg-amber-300 px-4 text-sm font-black text-slate-950 transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isPending ? "Working..." : "Confirm reset access"}
            </button>
          </div>
        ) : null}

        {resetResult?.code ? (
          <div className="space-y-3 rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-3">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-100">
              Temporary code
            </p>
            <p className="break-all font-mono text-3xl font-semibold text-white">
              {resetResult.code}
            </p>
            {resetResult.expiresAt ? (
              <p className="text-sm text-emerald-100">
                Expires: {resetResult.expiresAt}
              </p>
            ) : null}
            <p className="text-sm leading-6 text-emerald-100">
              Save or share this now. It may not be shown again.
            </p>
            <button
              type="button"
              onClick={handleCopyRecovery}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-black text-slate-950"
            >
              <Copy aria-hidden="true" className="h-4 w-4" />
              {copied ? "Copied" : "Copy recovery code"}
            </button>
            {canShare ? (
              <button
                type="button"
                onClick={handleShareRecovery}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-emerald-200/60 px-4 text-sm font-semibold text-white"
              >
                <Share2 aria-hidden="true" className="h-4 w-4" />
                Share recovery code
              </button>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
