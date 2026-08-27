"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Edit3, UserPlus } from "lucide-react";
import {
  assignFieldResidentToUnit,
  renameFieldUnit,
} from "@/features/entry/field/peopleActions";
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
