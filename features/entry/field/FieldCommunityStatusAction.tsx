"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Power, RotateCcw, X } from "lucide-react";
import { setFieldCommunityActiveStatus } from "@/features/entry/field/communityStatusActions";

type FieldCommunityStatusActionProps = {
  communityId: string;
  communityName: string;
  isActive: boolean;
  isReadOnlyPreview: boolean;
};

export function FieldCommunityStatusAction({
  communityId,
  communityName,
  isActive,
  isReadOnlyPreview,
}: FieldCommunityStatusActionProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const nextIsActive = !isActive;

  function submit() {
    setMessage(null);
    startTransition(async () => {
      const result = await setFieldCommunityActiveStatus({
        communityId,
        isActive: nextIsActive,
      });

      if (!result.success) {
        setMessage(result.error || "Could not update community status.");
        return;
      }

      setConfirming(false);
      router.refresh();
    });
  }

  return (
    <section className="space-y-3" aria-labelledby="community-status-title">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--console-accent)]">
        Community status
      </p>
      <div className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 id="community-status-title" className="text-base font-semibold text-[var(--console-text)]">
              {isActive ? "Active" : "Inactive"}
            </h2>
            <p className="mt-1 text-sm leading-5 text-[var(--console-text-muted)]">
              {isActive
                ? "ENTRY access is currently available for this community."
                : "Community access is suspended. Historical records remain preserved."}
            </p>
          </div>
          <span
            className={`h-2.5 w-2.5 shrink-0 rounded-full ${
              isActive ? "bg-emerald-400" : "bg-white/30"
            }`}
            aria-hidden="true"
          />
        </div>

        {message ? (
          <p className="mt-3 rounded-lg border border-rose-400/30 bg-rose-400/10 p-3 text-sm leading-5 text-rose-100">
            {message}
          </p>
        ) : null}

        {isReadOnlyPreview ? (
          <p className="mt-3 text-xs leading-5 text-amber-200">
            Preview is read-only. Community status changes are disabled.
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => {
            setMessage(null);
            setConfirming(true);
          }}
          disabled={isPending || isReadOnlyPreview}
          className={`mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border px-4 text-sm font-bold transition-colors disabled:opacity-50 ${
            isActive
              ? "border-rose-400/30 bg-rose-400/10 text-rose-200 hover:bg-rose-400/15"
              : "border-emerald-400/30 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/15"
          }`}
        >
          {isActive ? (
            <Power aria-hidden="true" className="h-4 w-4" />
          ) : (
            <RotateCcw aria-hidden="true" className="h-4 w-4" />
          )}
          {isActive ? "Deactivate community" : "Reactivate community"}
        </button>
      </div>

      {confirming ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="community-status-confirm-title"
            className="w-full max-w-md rounded-xl border border-[var(--console-border)] bg-[var(--console-surface-raised)] p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--console-accent)]">
                  Confirm action
                </p>
                <h2 id="community-status-confirm-title" className="mt-1 text-xl font-semibold text-[var(--console-text)]">
                  {isActive ? `Deactivate ${communityName}?` : `Reactivate ${communityName}?`}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={isPending}
                aria-label="Close confirmation"
                className="rounded-lg p-2 text-[var(--console-text-muted)] hover:bg-white/5"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-4 text-sm leading-6 text-[var(--console-text-muted)]">
              {isActive
                ? "This does not delete the community, units, residents, or history. It suspends ENTRY access until the community is reactivated. Active passes and frequent access are invalidated for safety."
                : "This restores the community and accounts that were suspended by the community deactivation. Previously invalidated passes and frequent-access records are not revived automatically."}
            </p>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={isPending}
                className="min-h-12 rounded-lg border border-[var(--console-border)] px-4 text-sm font-semibold text-[var(--console-text)] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={isPending || isReadOnlyPreview}
                className={`min-h-12 rounded-lg px-4 text-sm font-black disabled:opacity-50 ${
                  isActive
                    ? "bg-rose-500 text-white"
                    : "bg-emerald-400 text-slate-950"
                }`}
              >
                {isPending
                  ? "Working..."
                  : isActive
                    ? "Confirm deactivation"
                    : "Confirm reactivation"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
