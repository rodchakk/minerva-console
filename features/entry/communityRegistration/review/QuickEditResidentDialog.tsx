"use client";

import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import {
  quickEditCommunityRegistrationResident,
  type RegistrationQuickEditActionResult,
} from "@/features/entry/communityRegistration/review/quickEditActions";
import type { CommunityRegistrationQuickEditResident } from "@/features/entry/communityRegistration/review/quickEditQueries";

type QuickEditResidentDialogProps = {
  campaignUnitId: string;
  communityId: string;
  onClose: () => void;
  resident: CommunityRegistrationQuickEditResident;
  submissionId: string;
};

const initialState: RegistrationQuickEditActionResult | null = null;

export function QuickEditResidentDialog({
  campaignUnitId,
  communityId,
  onClose,
  resident,
  submissionId,
}: QuickEditResidentDialogProps) {
  const [state, formAction, pending] = useActionState(
    quickEditCommunityRegistrationResident,
    initialState,
  );

  useEffect(() => {
    if (state?.success) onClose();
  }, [onClose, state]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <form
        action={formAction}
        className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-xl"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-200">
          Edit resident
        </p>
        <h3 className="mt-2 text-xl font-semibold text-white">{resident.fullName}</h3>
        <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
          Correct a small detail without changing the household review status.
        </p>

        <input type="hidden" name="community_id" value={communityId} />
        <input type="hidden" name="campaign_unit_id" value={campaignUnitId} />
        <input type="hidden" name="submission_id" value={submissionId} />
        <input type="hidden" name="resident_id" value={resident.id} />

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="text-xs font-semibold text-[var(--text-muted)]">Full name</span>
            <input
              name="full_name"
              defaultValue={resident.fullName}
              required
              maxLength={160}
              autoFocus
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400/60"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-[var(--text-muted)]">Email</span>
            <input
              name="email"
              type="email"
              defaultValue={resident.email ?? ""}
              maxLength={254}
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400/60"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-[var(--text-muted)]">Phone</span>
            <input
              name="phone"
              defaultValue={resident.phone ?? ""}
              maxLength={32}
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400/60"
            />
          </label>
        </div>

        {state && !state.success ? (
          <p className="mt-4 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {state.error}
          </p>
        ) : null}

        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="secondary" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
