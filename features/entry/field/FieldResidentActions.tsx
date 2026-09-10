"use client";

import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  House,
  KeyRound,
  Pencil,
  Save,
  Share2,
  X,
} from "lucide-react";
import { assignFieldResidentToUnit } from "@/features/entry/field/peopleActions";
import {
  resetFieldResidentAccess,
  type FieldResetAccessResult,
} from "@/features/entry/field/residentAccessActions";
import { updateFieldResidentProfile } from "@/features/entry/field/residentProfileActions";
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

type ActionPanel = "profile" | "access" | "unit" | null;

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
    `ENTRY temporary access PIN for ${input.residentName}: ${input.code}`,
    input.expiresAt ? `Expires: ${input.expiresAt}` : "",
    "Use it now. It may not be shown again.",
  ]
    .filter(Boolean)
    .join("\n");
}

const actionButtonClass =
  "flex min-h-20 flex-col items-center justify-center gap-2 rounded-lg border border-[var(--console-border)] bg-white/[0.025] px-2 py-3 text-center text-xs font-semibold text-[var(--console-text)] transition-colors hover:border-[var(--console-accent-border)] hover:bg-white/[0.05]";

export function FieldResidentActions({
  communityId,
  isReadOnlyPreview,
  resident,
  unitState,
  units,
}: FieldResidentActionsProps) {
  const router = useRouter();
  const [panel, setPanel] = useState<ActionPanel>(null);
  const [fullName, setFullName] = useState(resident.fullName);
  const [phone, setPhone] = useState(resident.phone);
  const [selectedUnitId, setSelectedUnitId] = useState(resident.houseId);
  const [confirmingMove, setConfirmingMove] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<FieldResetAccessResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const canShare = useSyncExternalStore(subscribe, getShareSnapshot, getServerSnapshot);

  const assignmentUnits = useMemo(
    () => getFieldResidentAssignmentUnits(units, resident.houseId),
    [resident.houseId, units],
  );
  const selectedUnit = useMemo(
    () => assignmentUnits.find((unit) => unit.id === selectedUnitId) ?? null,
    [assignmentUnits, selectedUnitId],
  );
  const canMove = Boolean(
    selectedUnit?.isActive && selectedUnitId && selectedUnitId !== resident.houseId,
  );
  const resetMode = canSendResidentResetEmail(resident)
    ? "email"
    : canUseResidentRecoveryCode(resident)
      ? "recovery_code"
      : "unsupported";
  const recoveryMessage = resetResult?.code
    ? buildRecoveryMessage({
        code: resetResult.code,
        expiresAt: resetResult.expiresAt,
        residentName: resident.fullName,
      })
    : "";

  function openPanel(next: Exclude<ActionPanel, null>) {
    setMessage(null);
    setPanel((current) => (current === next ? null : next));

    if (next === "profile") {
      setFullName(resident.fullName);
      setPhone(resident.phone);
    }
    if (next === "unit") {
      setSelectedUnitId(resident.houseId);
      setConfirmingMove(false);
    }
    if (next === "access") {
      setConfirmingReset(false);
      setResetResult(null);
      setCopied(false);
    }
  }

  function saveProfile() {
    setMessage(null);
    startTransition(async () => {
      const result = await updateFieldResidentProfile({
        communityId,
        fullName,
        phone,
        userId: resident.userId,
      });

      if (!result.success) {
        setMessage(result.error || "Could not update resident profile.");
        return;
      }

      setPanel(null);
      setMessage("Resident profile updated.");
      router.refresh();
    });
  }

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
      setPanel(null);
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
          : "Temporary access PIN generated.",
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
      setMessage("Could not copy the temporary access PIN.");
    }
  }

  async function handleShareRecovery() {
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
    <section className="space-y-3" aria-labelledby="resident-quick-actions">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--console-accent)]">
          Quick actions
        </p>
        <h2 id="resident-quick-actions" className="sr-only">
          Resident quick actions
        </h2>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button type="button" onClick={() => openPanel("profile")} className={actionButtonClass}>
          <Pencil aria-hidden="true" className="h-5 w-5 text-[var(--console-accent)]" />
          Edit profile
        </button>
        <button
          type="button"
          onClick={() => openPanel("access")}
          className={actionButtonClass}
        >
          <KeyRound aria-hidden="true" className="h-5 w-5 text-[var(--console-accent)]" />
          {resetMode === "recovery_code" ? "Reset PIN" : "Reset access"}
        </button>
        <button type="button" onClick={() => openPanel("unit")} className={actionButtonClass}>
          <House aria-hidden="true" className="h-5 w-5 text-[var(--console-accent)]" />
          Change unit
        </button>
      </div>

      {message ? (
        <p className="rounded-lg border border-[var(--console-border)] bg-white/[0.03] p-3 text-sm leading-6 text-[var(--console-text-muted)]">
          {message}
        </p>
      ) : null}

      {panel === "profile" ? (
        <div className="space-y-4 rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-[var(--console-text)]">Edit profile</h3>
            <button
              type="button"
              onClick={() => setPanel(null)}
              className="rounded-md p-2 text-[var(--console-text-muted)] hover:bg-white/5"
              aria-label="Close profile editor"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
          <label className="grid gap-2 text-sm font-semibold text-[var(--console-text)]">
            Full name
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              maxLength={120}
              autoComplete="name"
              className="min-h-12 rounded-lg border border-[var(--console-border)] bg-[var(--console-bg)] px-3 text-base font-normal outline-none focus:border-[var(--console-accent)]"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-[var(--console-text)]">
            Phone
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              maxLength={40}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="Optional"
              className="min-h-12 rounded-lg border border-[var(--console-border)] bg-[var(--console-bg)] px-3 text-base font-normal outline-none focus:border-[var(--console-accent)]"
            />
          </label>
          {isReadOnlyPreview ? (
            <p className="text-xs leading-5 text-amber-200">Preview is read-only. Save is disabled.</p>
          ) : null}
          <button
            type="button"
            onClick={saveProfile}
            disabled={isPending || isReadOnlyPreview || !fullName.trim()}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[var(--console-accent)] px-4 text-sm font-bold text-white disabled:opacity-50"
          >
            <Save aria-hidden="true" className="h-4 w-4" />
            {isPending ? "Saving..." : "Save changes"}
          </button>
        </div>
      ) : null}

      {panel === "unit" ? (
        <div className="space-y-3 rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
          <h3 className="text-base font-semibold text-[var(--console-text)]">Change unit</h3>
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
                  {!unit.isActive && unit.id === resident.houseId ? " (current, inactive)" : ""}
                </option>
              ))}
            </select>
          )}
          {!confirmingMove ? (
            <button
              type="button"
              onClick={() => setConfirmingMove(true)}
              disabled={!canMove || isPending || isReadOnlyPreview || unitState !== "ready"}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[var(--console-accent)] px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              <Check aria-hidden="true" className="h-4 w-4" />
              Continue
            </button>
          ) : (
            <div className="space-y-3 rounded-lg border border-amber-300/30 bg-amber-300/10 p-3">
              <p className="text-sm leading-6 text-amber-100">
                Move {resident.fullName} from {resident.houseLabel} to {selectedUnit?.label ?? "the selected unit"}?
              </p>
              <button
                type="button"
                onClick={handleMove}
                disabled={isPending || isReadOnlyPreview || !canMove}
                className="min-h-12 w-full rounded-lg bg-amber-300 px-4 text-sm font-black text-slate-950 disabled:opacity-50"
              >
                {isPending ? "Saving..." : "Confirm unit change"}
              </button>
            </div>
          )}
        </div>
      ) : null}

      {panel === "access" ? (
        <div className="space-y-3 rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
          <h3 className="text-base font-semibold text-[var(--console-text)]">
            {resetMode === "recovery_code" ? "Reset access PIN" : "Reset access"}
          </h3>
          {resetMode === "email" ? (
            <p className="break-words text-sm leading-6 text-[var(--console-text-muted)]">
              A password reset email will be sent to {resident.email}.
            </p>
          ) : resetMode === "recovery_code" ? (
            <p className="text-sm leading-6 text-[var(--console-text-muted)]">
              Generate a temporary six-digit access PIN for this username-only account. It is shown once and expires after 24 hours.
            </p>
          ) : (
            <p className="text-sm leading-6 text-[var(--console-text-muted)]">
              This account does not support the resident recovery flow from Field.
            </p>
          )}

          {resetMode !== "unsupported" && !confirmingReset && !resetResult?.code ? (
            <button
              type="button"
              onClick={() => setConfirmingReset(true)}
              disabled={isPending || isReadOnlyPreview}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-[var(--console-border)] bg-white/5 px-4 text-sm font-semibold text-[var(--console-text)] hover:bg-white/10 disabled:opacity-50"
            >
              <KeyRound aria-hidden="true" className="h-4 w-4" />
              {resetMode === "email" ? "Send password reset email" : "Generate temporary PIN"}
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
                className="min-h-12 w-full rounded-lg bg-amber-300 px-4 text-sm font-black text-slate-950 disabled:opacity-50"
              >
                {isPending ? "Working..." : "Confirm reset access"}
              </button>
            </div>
          ) : null}

          {resetResult?.code ? (
            <div className="space-y-3 rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-3">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-100">
                Temporary access PIN
              </p>
              <p className="break-all font-mono text-3xl font-semibold text-white">
                {resetResult.code}
              </p>
              {resetResult.expiresAt ? (
                <p className="text-sm text-emerald-100">Expires: {resetResult.expiresAt}</p>
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
                {copied ? "Copied" : "Copy temporary PIN"}
              </button>
              {canShare ? (
                <button
                  type="button"
                  onClick={handleShareRecovery}
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-emerald-200/60 px-4 text-sm font-semibold text-white"
                >
                  <Share2 aria-hidden="true" className="h-4 w-4" />
                  Share temporary PIN
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
