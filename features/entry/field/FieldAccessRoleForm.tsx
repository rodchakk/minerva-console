"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { ShieldCheck } from "lucide-react";
import {
  changeFieldUserRoleAction,
  type FieldRoleActionState,
} from "@/features/entry/field/accessActions";

export type FieldAccessRole = "ADMIN" | "GUARD" | "RESIDENT" | "UNASSIGNED";

export type FieldAccessUnitOption = {
  id: string;
  label: string;
};

function SaveRoleButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="min-h-12 w-full rounded-lg bg-[var(--console-accent)] px-4 text-sm font-bold text-white transition-colors hover:brightness-110 active:brightness-95 disabled:opacity-50"
    >
      {pending ? "Updating..." : "Update role"}
    </button>
  );
}

export function FieldAccessRoleForm({
  communityId,
  currentHouseId,
  currentRole,
  isCurrentUser,
  units,
  userId,
}: {
  communityId: string;
  currentHouseId: string;
  currentRole: FieldAccessRole;
  isCurrentUser: boolean;
  units: FieldAccessUnitOption[];
  userId: string;
}) {
  const [state, action] = useActionState<FieldRoleActionState, FormData>(
    changeFieldUserRoleAction,
    {},
  );
  const initialRole = currentRole === "UNASSIGNED" ? "ADMIN" : currentRole;
  const [role, setRole] = useState<"ADMIN" | "GUARD" | "RESIDENT">(initialRole);
  const needsResidentUnit = role === "RESIDENT" && !currentHouseId;

  if (isCurrentUser) {
    return (
      <section className="space-y-3 rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck aria-hidden="true" className="h-5 w-5 text-emerald-300" />
          <h2 className="text-lg font-semibold text-[var(--console-text)]">
            Role protected
          </h2>
        </div>
        <p className="text-sm leading-6 text-[var(--console-text-muted)]">
          This is your current Field account. Your own ENTRY role cannot be changed from Field.
        </p>
      </section>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="communityId" value={communityId} />
      <input type="hidden" name="userId" value={userId} />

      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-[var(--console-text)]">
          New role
        </span>
        <select
          name="role"
          value={role}
          onChange={(event) =>
            setRole(event.target.value as "ADMIN" | "GUARD" | "RESIDENT")
          }
          className="min-h-12 w-full rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] px-3 text-base text-[var(--console-text)] outline-none focus:border-[var(--console-accent-border)]"
        >
          <option value="RESIDENT">Resident</option>
          <option value="ADMIN">Admin</option>
          <option value="GUARD">Guard</option>
        </select>
      </label>

      {needsResidentUnit ? (
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-[var(--console-text)]">
            Resident unit
          </span>
          <select
            name="houseId"
            defaultValue=""
            className="min-h-12 w-full rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] px-3 text-base text-[var(--console-text)] outline-none focus:border-[var(--console-accent-border)]"
          >
            <option value="" disabled>
              Select unit
            </option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.label}
              </option>
            ))}
          </select>
          <span className="mt-2 block text-xs leading-5 text-[var(--console-text-soft)]">
            Residents require a unit. Guard accounts do not.
          </span>
        </label>
      ) : null}

      {role === "GUARD" && currentHouseId ? (
        <p className="rounded-lg border border-amber-300/25 bg-amber-300/10 p-3 text-sm leading-6 text-amber-100">
          Changing this account to Guard removes its current unit assignment.
        </p>
      ) : null}

      {currentRole === "UNASSIGNED" && role === "RESIDENT" ? (
        <p className="rounded-lg border border-amber-300/25 bg-amber-300/10 p-3 text-sm leading-6 text-amber-100">
          Unassigned accounts must first be assigned through People before becoming Residents.
        </p>
      ) : null}

      {state.message ? (
        <p
          className={`rounded-lg border p-3 text-sm leading-6 ${
            state.ok
              ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100"
              : "border-rose-300/25 bg-rose-300/10 text-rose-100"
          }`}
        >
          {state.message}
        </p>
      ) : null}

      <SaveRoleButton
        disabled={currentRole === role || (currentRole === "UNASSIGNED" && role === "RESIDENT")}
      />
    </form>
  );
}
