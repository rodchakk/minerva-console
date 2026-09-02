"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, House } from "lucide-react";
import { assignFieldAdminToUnit } from "@/features/entry/field/adminProfileActions";
import {
  getFieldResidentAssignmentUnits,
  type FieldResident,
  type FieldUnit,
} from "@/features/entry/field/peopleModel";

type Props = {
  communityId: string;
  isReadOnlyPreview: boolean;
  unitState: "ready" | "unavailable";
  units: FieldUnit[];
  user: FieldResident;
};

export function FieldAdminUnitAssignment({
  communityId,
  isReadOnlyPreview,
  unitState,
  units,
  user,
}: Props) {
  const router = useRouter();
  const [selectedUnitId, setSelectedUnitId] = useState(user.houseId);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const assignmentUnits = useMemo(
    () => getFieldResidentAssignmentUnits(units, user.houseId),
    [units, user.houseId],
  );
  const selectedUnit = useMemo(
    () => assignmentUnits.find((unit) => unit.id === selectedUnitId) ?? null,
    [assignmentUnits, selectedUnitId],
  );
  const canAssign = Boolean(
    selectedUnit?.isActive && selectedUnitId && selectedUnitId !== user.houseId,
  );

  function handleAssign() {
    if (!selectedUnitId) return;
    setMessage(null);

    startTransition(async () => {
      const result = await assignFieldAdminToUnit({
        communityId,
        unitId: selectedUnitId,
        userId: user.userId,
      });

      if (!result.success) {
        setMessage(result.error || "Could not update admin unit.");
        return;
      }

      setConfirming(false);
      setMessage("Admin unit updated.");
      router.refresh();
    });
  }

  return (
    <section className="space-y-3 rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
      <div className="flex items-center gap-2">
        <House aria-hidden="true" className="h-4 w-4 text-[var(--console-accent)]" />
        <h2 className="text-lg font-semibold text-[var(--console-text)]">
          Admin unit
        </h2>
      </div>
      <p className="text-sm leading-6 text-[var(--console-text-muted)]">
        Admin accounts may be linked to a unit. Their ADMIN role stays unchanged.
      </p>

      {message ? (
        <p className="rounded-lg border border-[var(--console-border)] bg-white/[0.03] p-3 text-sm leading-6 text-[var(--console-text-muted)]">
          {message}
        </p>
      ) : null}

      {unitState === "unavailable" ? (
        <p className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-3 text-sm leading-6 text-amber-100">
          Unit list unavailable.
        </p>
      ) : (
        <select
          value={selectedUnitId}
          onChange={(event) => {
            setSelectedUnitId(event.target.value);
            setConfirming(false);
          }}
          disabled={isReadOnlyPreview || isPending}
          className="min-h-12 w-full rounded-lg border border-[var(--console-border)] bg-black/20 px-3 text-base text-[var(--console-text)] outline-none focus:border-[var(--console-accent)] disabled:opacity-60"
        >
          <option value="">Select unit</option>
          {assignmentUnits.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.label}
              {!unit.isActive && unit.id === user.houseId
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

      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={
            !canAssign || isPending || isReadOnlyPreview || unitState !== "ready"
          }
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[var(--console-accent)] px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Check aria-hidden="true" className="h-4 w-4" />
          {user.houseId ? "Change unit" : "Assign unit"}
        </button>
      ) : (
        <div className="space-y-3 rounded-lg border border-amber-300/30 bg-amber-300/10 p-3">
          <p className="text-sm leading-6 text-amber-100">
            {user.houseId
              ? `Move ${user.fullName} from ${user.houseLabel} to ${selectedUnit?.label ?? "the selected unit"}?`
              : `Assign ${user.fullName} to ${selectedUnit?.label ?? "the selected unit"}?`}
          </p>
          <p className="text-xs leading-5 text-amber-100/80">
            This changes only the unit link. The account remains ADMIN.
          </p>
          <button
            type="button"
            onClick={handleAssign}
            disabled={isPending || isReadOnlyPreview || !canAssign}
            className="min-h-12 w-full rounded-lg bg-amber-300 px-4 text-sm font-black text-slate-950 transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? "Saving..." : "Confirm unit assignment"}
          </button>
        </div>
      )}
    </section>
  );
}
