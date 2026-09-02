"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Power, PowerOff, ShieldCheck } from "lucide-react";
import { setCommunityUserActiveStatusAction } from "@/features/entry/users/actions";
import type { FieldResident } from "@/features/entry/field/peopleModel";

type FieldUserStatusActionProps = {
  communityId: string;
  isCurrentUser: boolean;
  isReadOnlyPreview: boolean;
  user: FieldResident;
};

export function FieldUserStatusAction({
  communityId,
  isCurrentUser,
  isReadOnlyPreview,
  user,
}: FieldUserStatusActionProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const nextActiveState = !user.isActive;

  function handleStatusChange() {
    if (isCurrentUser && !nextActiveState) {
      setMessage("Your own account is protected and cannot be deactivated from Field.");
      return;
    }

    setMessage(null);

    startTransition(async () => {
      const result = await setCommunityUserActiveStatusAction({
        communityId,
        isActive: nextActiveState,
        userId: user.userId,
      });

      if (!result.success) {
        const normalizedError = (result.error || "").toLowerCase();
        const errorMessage =
          normalizedError.includes("cannot_disable_self") ||
          normalizedError.includes("cannot deactivate your own")
            ? "Your own account is protected and cannot be deactivated from Field."
            : normalizedError.includes("another active superadmin")
              ? "Protected Minerva system owner accounts cannot be changed from Field."
              : result.error || "Could not update account status.";

        setMessage(errorMessage);
        return;
      }

      setConfirming(false);
      setMessage(nextActiveState ? "Account reactivated." : "Account deactivated.");
      router.refresh();
    });
  }

  if (isCurrentUser) {
    return (
      <section className="space-y-3 rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck aria-hidden="true" className="h-4 w-4 text-emerald-300" />
          <h2 className="text-lg font-semibold text-[var(--console-text)]">
            Account status
          </h2>
        </div>
        <p className="text-sm leading-6 text-[var(--console-text-muted)]">
          Your own Field account is protected and cannot be deactivated here.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
      <div className="flex items-center gap-2">
        {user.isActive ? (
          <PowerOff aria-hidden="true" className="h-4 w-4 text-amber-300" />
        ) : (
          <Power aria-hidden="true" className="h-4 w-4 text-emerald-300" />
        )}
        <h2 className="text-lg font-semibold text-[var(--console-text)]">
          Account status
        </h2>
      </div>

      <p className="text-sm leading-6 text-[var(--console-text-muted)]">
        {user.isActive
          ? `Deactivate this ${user.role.toLowerCase()} account's community access without deleting the account or history.`
          : `Reactivate this ${user.role.toLowerCase()} account's existing community access.`}
      </p>

      {isReadOnlyPreview ? (
        <p className="text-xs leading-5 text-amber-200">
          Preview is read-only. Account status changes are disabled.
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
          {user.isActive ? (
            <PowerOff aria-hidden="true" className="h-4 w-4" />
          ) : (
            <Power aria-hidden="true" className="h-4 w-4" />
          )}
          {user.isActive ? "Deactivate account" : "Reactivate account"}
        </button>
      ) : (
        <div className="space-y-3 rounded-lg border border-amber-300/30 bg-amber-300/10 p-3">
          <p className="text-sm leading-6 text-amber-100">
            {user.isActive
              ? `Deactivate ${user.fullName} (${user.role})? They will lose access to this community until reactivated.`
              : `Reactivate ${user.fullName} (${user.role})? Their existing community access will become active again.`}
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
                : user.isActive
                  ? "Confirm deactivate"
                  : "Confirm reactivate"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
