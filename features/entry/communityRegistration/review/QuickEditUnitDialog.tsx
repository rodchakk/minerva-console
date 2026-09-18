"use client";

import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import {
  quickEditCommunityRegistrationUnitLabel,
  type RegistrationQuickEditActionResult,
} from "@/features/entry/communityRegistration/review/quickEditActions";

type QuickEditUnitDialogProps = {
  campaignUnitId: string;
  communityId: string;
  currentLabel: string;
  onClose: () => void;
};

const initialState: RegistrationQuickEditActionResult | null = null;

export function QuickEditUnitDialog({
  campaignUnitId,
  communityId,
  currentLabel,
  onClose,
}: QuickEditUnitDialogProps) {
  const [state, formAction, pending] = useActionState(
    quickEditCommunityRegistrationUnitLabel,
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
          Edit unit
        </p>
        <h3 className="mt-2 text-xl font-semibold text-white">{currentLabel}</h3>
        <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
          Correct the resident-provided unit number or label without changing the
          household review status.
        </p>

        <input type="hidden" name="community_id" value={communityId} />
        <input type="hidden" name="campaign_unit_id" value={campaignUnitId} />

        <label className="mt-5 block">
          <span className="text-xs font-semibold text-[var(--text-muted)]">
            Unit number / label
          </span>
          <input
            name="unit_label"
            defaultValue={currentLabel}
            required
            maxLength={160}
            autoFocus
            className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400/60"
          />
          <span className="mt-2 block text-xs leading-5 text-[var(--text-muted)]">
            Example: Casa 13. This is available only before the household is reviewed.
          </span>
        </label>

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
            {pending ? "Saving..." : "Save unit"}
          </Button>
        </div>
      </form>
    </div>
  );
}
