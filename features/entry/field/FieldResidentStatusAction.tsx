"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Power, PowerOff } from "lucide-react";
import { setFieldResidentActiveStatus } from "@/features/entry/field/quickResidentActions";
import type { FieldResident } from "@/features/entry/field/peopleModel";

type FieldResidentStatusActionProps = {
  communityId: string;
  isReadOnlyPreview: boolean;
  resident: FieldResident;
};

export function FieldResidentStatusAction({
  communityId,
  isReadOnlyPreview,
  resident,
}: FieldResidentStatusActionProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const nextActiveState = !resident.isActive;

  function handleStatusChange() {
    setMessage(null);

    startTransition(async () => {
      const result = await setFieldResidentActiveStatus({
        communityId,
        isActive: nextActiveState,
        userId: resident.userId,
      });

      if (!result.success) {
        setMessage(result.error || "Could not update resident status.");
        return;
      }

      setConfirming(false);
      setMessage(nextActiveState ? "Resident reactivated." : "Resident deactivated.");
      router.refresh();
    });
  }

  return (
    <section className="space-y-3 rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
      <div className="flex items-center gap-2">
        {resident.isActive ? (
          <PowerOff aria-hidden="true" className="h-4 w-4 text-amber-300" />
        ) : (
          <Power aria-hidden="true" className="h-4 w-4 text-emerald-300" />
        )}
        <h2 className="text-lg font-semibold text-[var(--console-text)]">
          Account status
        </h2>
      </div>

      <p className="text-sm leading-6 text-[var(--console-text-muted)]">
        {resident.isActive
          ? "Deactivate this resident's community access without deleting the account or history."
          : "Reactivate this resident's existing community access."}
      </p>

      {isReadOnlyPreview ? (
        <p className="text-xs leading-5 text-amber-200">
          Preview is read-only. Resident status changes are disabled.
        </p>
      ) : null}

      {message ? (
        <p className="rounded-lg border border-[var(--console-border)] bg-white/[0.03] p-3 text-sm leading-6 text-[var(--console-text-muted)]">
          {message}
        </p>
      ) : null}

      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={isPending || isReadOnlyPreview}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-[var(--console-border)] bg-white/5 px-4 text-sm font-semibold text-[var(--console-text)] transition-colors hover:bg-white/10 disabled:opacity-50"
        >
          {resident.isActive ? (
            <PowerOff aria-hidden="true" className="h-4 w-4" />
          ) : (
            <Power aria-hidden="true" className="h-4 w-4" />
          )}
          {resident.isActive ? "Deactivate resident" : "Reactivate resident"}
        </button>
      ) : (
        <div className="space-y-3 rounded-lg border border-amber-300/30 bg-amber-300/10 p-3">
          <p className="text-sm leading-6 text-amber-100">
            {resident.isActive
              ? `Deactivate ${resident.fullName}? They will lose community access until reactivated.`
              : `Reactivate ${resident.fullName}? Their existing community account will become active again.`}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={isPending}
              className="min-h-12 rounded-lg border border-amber-200/30 px-3 text-sm font-semibold text-amber-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleStatusChange}
              disabled={isPending || isReadOnlyPreview}
              className="min-h-12 rounded-lg bg-amber-300 px-3 text-sm font-black text-slate-950 disabled:opacity-50"
            >
              {isPending
                ? "Saving..."
                : resident.isActive
                  ? "Confirm deactivate"
                  : "Confirm reactivate"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
