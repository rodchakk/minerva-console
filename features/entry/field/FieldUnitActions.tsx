"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Edit3, Power, RotateCcw, UserPlus } from "lucide-react";
import {
  assignFieldResidentToUnit,
  renameFieldUnit,
} from "@/features/entry/field/peopleActions";
import { setFieldUnitActiveStatus } from "@/features/entry/field/unitStatusActions";
import type {
  FieldResident,
  FieldUnit,
} from "@/features/entry/field/peopleModel";

type FieldUnitActionsProps = {
  communityId: string;
  eligibleResidents: FieldResident[];
  isReadOnlyPreview: boolean;
  residentState: "ready" | "unavailable";
  unit: FieldUnit;
};

export function FieldUnitActions({
  communityId,
  eligibleResidents,
  isReadOnlyPreview,
  residentState,
  unit,
}: FieldUnitActionsProps) {
  const router = useRouter();
  const [label, setLabel] = useState(unit.label);
  const [confirmingRename, setConfirmingRename] = useState(false);
  const [confirmingStatus, setConfirmingStatus] = useState(false);
  const [selectedResidentId, setSelectedResidentId] = useState("");
  const [confirmingAssign, setConfirmingAssign] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedResident = useMemo(
    () =>
      eligibleResidents.find((resident) => resident.userId === selectedResidentId) ??
      null,
    [eligibleResidents, selectedResidentId],
  );
  const trimmedLabel = label.trim();
  const canRename = trimmedLabel.length > 0 && trimmedLabel !== unit.label;
  const canAssignResident = residentState === "ready" && unit.isActive;
  const nextUnitActiveState = !unit.isActive;

  function handleRename() {
    setMessage(null);

    startTransition(async () => {
      const result = await renameFieldUnit({
        communityId,
        unitId: unit.id,
        unitLabel: trimmedLabel,
      });

      if (!result.success) {
        setMessage(result.error || "Could not rename unit.");
        return;
      }

      setConfirmingRename(false);
      setMessage("Unit renamed.");
    });
  }

  function handleStatusChange() {
    setMessage(null);

    startTransition(async () => {
      const result = await setFieldUnitActiveStatus({
        communityId,
        isActive: nextUnitActiveState,
        unitId: unit.id,
      });

      if (!result.success) {
        setMessage(result.error || "Could not update unit status.");
        return;
      }

      setConfirmingStatus(false);
      setMessage(nextUnitActiveState ? "Unit reactivated." : "Unit deactivated.");
      router.refresh();
    });
  }

  function handleAssign() {
    if (!selectedResidentId) return;
    setMessage(null);

    startTransition(async () => {
      const result = await assignFieldResidentToUnit({
        communityId,
        unitId: unit.id,
        userId: selectedResidentId,
      });

      if (!result.success) {
        setMessage(result.error || "Could not add resident.");
        return;
      }

      setConfirmingAssign(false);
      setSelectedResidentId("");
      setMessage("Resident assigned to unit.");
      router.refresh();
    });
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
          {unit.isActive ? (
            <Power
              aria-hidden="true"
              className="h-4 w-4 text-[var(--console-accent)]"
            />
          ) : (
            <RotateCcw
              aria-hidden="true"
              className="h-4 w-4 text-[var(--console-accent)]"
            />
          )}
          <h2 className="text-lg font-semibold text-[var(--console-text)]">
            Unit status
          </h2>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--console-border)] bg-white/[0.03] px-3 py-3">
          <div>
            <p className="text-sm font-semibold text-[var(--console-text)]">
              {unit.isActive ? "Active" : "Inactive"}
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--console-text-soft)]">
              {unit.isActive
                ? "Deactivate this unit when it should no longer have ENTRY access."
                : "Reactivate this unit to restore the unit according to ENTRY access rules."}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold ${
              unit.isActive
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
                : "border-white/15 bg-white/5 text-[var(--console-text-soft)]"
            }`}
          >
            {unit.isActive ? "Active" : "Inactive"}
          </span>
        </div>
        {isReadOnlyPreview ? (
          <p className="text-xs leading-5 text-amber-200">
            Preview is read-only. Unit status changes are disabled.
          </p>
        ) : null}
        {!confirmingStatus ? (
          <button
            type="button"
            onClick={() => setConfirmingStatus(true)}
            disabled={isPending || isReadOnlyPreview}
            className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 ${
              unit.isActive
                ? "border border-rose-400/30 bg-rose-400/10 text-rose-100"
                : "bg-[var(--console-accent)] text-white"
            }`}
          >
            {unit.isActive ? (
              <Power aria-hidden="true" className="h-4 w-4" />
            ) : (
              <RotateCcw aria-hidden="true" className="h-4 w-4" />
            )}
            {unit.isActive ? "Deactivate unit" : "Reactivate unit"}
          </button>
        ) : (
          <div className="space-y-3 rounded-lg border border-amber-300/30 bg-amber-300/10 p-3">
            <p className="break-words text-sm leading-6 text-amber-100">
              {unit.isActive
                ? `Deactivate ${unit.label}? Residents linked to this unit will be deactivated according to ENTRY unit-status rules.`
                : `Reactivate ${unit.label}? Residents previously deactivated by this unit will be restored according to ENTRY unit-status rules.`}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setConfirmingStatus(false)}
                disabled={isPending}
                className="min-h-12 rounded-lg border border-white/15 bg-white/5 px-4 text-sm font-semibold text-amber-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStatusChange}
                disabled={isPending || isReadOnlyPreview}
                className="min-h-12 rounded-lg bg-amber-300 px-4 text-sm font-black text-slate-950 transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {isPending
                  ? "Saving..."
                  : unit.isActive
                    ? "Confirm off"
                    : "Confirm on"}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
        <div className="flex items-center gap-2">
          <Edit3
            aria-hidden="true"
            className="h-4 w-4 text-[var(--console-accent)]"
          />
          <h2 className="text-lg font-semibold text-[var(--console-text)]">
            Rename unit
          </h2>
        </div>
        <input
          value={label}
          onChange={(event) => {
            setLabel(event.target.value);
            setConfirmingRename(false);
          }}
          disabled={isReadOnlyPreview || isPending}
          className="min-h-12 w-full rounded-lg border border-[var(--console-border)] bg-white/[0.03] px-3 text-base text-[var(--console-text)] outline-none focus:border-[var(--console-accent)] disabled:opacity-60"
        />
        {isReadOnlyPreview ? (
          <p className="text-xs leading-5 text-amber-200">
            Preview is read-only. Rename is disabled.
          </p>
        ) : null}
        {!confirmingRename ? (
          <button
            type="button"
            onClick={() => setConfirmingRename(true)}
            disabled={!canRename || isPending || isReadOnlyPreview}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[var(--console-accent)] px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Check aria-hidden="true" className="h-4 w-4" />
            Continue
          </button>
        ) : (
          <div className="space-y-3 rounded-lg border border-amber-300/30 bg-amber-300/10 p-3">
            <p className="break-words text-sm leading-6 text-amber-100">
              Rename {unit.label} to {trimmedLabel}?
            </p>
            <button
              type="button"
              onClick={handleRename}
              disabled={isPending || isReadOnlyPreview}
              className="min-h-12 w-full rounded-lg bg-amber-300 px-4 text-sm font-black text-slate-950 transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isPending ? "Saving..." : "Confirm rename"}
            </button>
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
        <div className="flex items-center gap-2">
          <UserPlus
            aria-hidden="true"
            className="h-4 w-4 text-[var(--console-accent)]"
          />
          <h2 className="text-lg font-semibold text-[var(--console-text)]">
            Add resident
          </h2>
        </div>
        {!unit.isActive ? (
          <p className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-3 text-sm leading-6 text-amber-100">
            This unit is inactive. Resident assignment from Field is unavailable.
          </p>
        ) : residentState === "unavailable" ? (
          <p className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-3 text-sm leading-6 text-amber-100">
            Resident choices unavailable.
          </p>
        ) : (
          <select
            value={selectedResidentId}
            onChange={(event) => {
              setSelectedResidentId(event.target.value);
              setConfirmingAssign(false);
            }}
            disabled={isReadOnlyPreview || isPending}
            className="min-h-12 w-full rounded-lg border border-[var(--console-border)] bg-black/20 px-3 text-base text-[var(--console-text)] outline-none focus:border-[var(--console-accent)] disabled:opacity-60"
          >
            <option value="">Select resident</option>
            {eligibleResidents.map((resident) => (
              <option key={resident.userId} value={resident.userId}>
                {resident.fullName} - {resident.houseLabel}
              </option>
            ))}
          </select>
        )}
        {isReadOnlyPreview ? (
          <p className="text-xs leading-5 text-amber-200">
            Preview is read-only. Resident assignment is disabled.
          </p>
        ) : null}
        {!confirmingAssign ? (
          <button
            type="button"
            onClick={() => setConfirmingAssign(true)}
            disabled={
              !selectedResidentId ||
              isPending ||
              isReadOnlyPreview ||
              !canAssignResident
            }
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-[var(--console-border)] bg-white/5 px-4 text-sm font-semibold text-[var(--console-text)] transition-colors hover:bg-white/10 disabled:opacity-50"
          >
            <UserPlus aria-hidden="true" className="h-4 w-4" />
            Continue
          </button>
        ) : (
          <div className="space-y-3 rounded-lg border border-amber-300/30 bg-amber-300/10 p-3">
            <p className="break-words text-sm leading-6 text-amber-100">
              Add {selectedResident?.fullName ?? "this resident"} to {unit.label}?
            </p>
            <button
              type="button"
              onClick={handleAssign}
              disabled={isPending || isReadOnlyPreview || !canAssignResident}
              className="min-h-12 w-full rounded-lg bg-amber-300 px-4 text-sm font-black text-slate-950 transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isPending ? "Saving..." : "Confirm assignment"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
