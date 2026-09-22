"use client";

import { Trash2 } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  quickEditCommunityRegistrationResident,
  removeCommunityRegistrationResident,
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
  const [removeState, removeAction, removePending] = useActionState(
    removeCommunityRegistrationResident,
    initialState,
  );
  const [confirmRemoval, setConfirmRemoval] = useState(false);

  useEffect(() => {
    if (state?.success || removeState?.success) onClose();
  }, [onClose, removeState, state]);

  const busy = pending || removePending;

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

        <div className="mt-6 rounded-xl border border-rose-400/20 bg-rose-500/[0.06] p-4">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-rose-500/10 text-rose-200">
              <Trash2 className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-rose-100">Danger zone</p>
              <p className="mt-1 text-xs leading-5 text-rose-100/70">
                Remove this person from the active household if they should not
                become an ENTRY resident. The original record is preserved in
                private audit history.
              </p>

              {!confirmRemoval ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmRemoval(true)}
                  className="mt-3 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/15 disabled:opacity-50"
                >
                  Remove resident from household
                </button>
              ) : (
                <div className="mt-4 rounded-lg border border-rose-400/20 bg-black/10 p-3">
                  <p className="text-sm font-semibold text-white">
                    Remove {resident.fullName}?
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                    They will disappear from this Submitted registration and will
                    not be shown to Patronato or moved to Activation Queue from
                    this household.
                    {resident.position === 1
                      ? " The next resident will become the primary resident."
                      : ""}
                  </p>
                  <label className="mt-3 block">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                      Reason (optional)
                    </span>
                    <input
                      name="removal_reason"
                      maxLength={500}
                      placeholder="Example: Should not receive an ENTRY user"
                      className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2 text-xs text-white outline-none focus:border-rose-400/50"
                    />
                  </label>

                  {removeState && !removeState.success ? (
                    <p className="mt-3 rounded-lg border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                      {removeState.error}
                    </p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setConfirmRemoval(false)}
                      className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--text-muted)] transition hover:text-white disabled:opacity-50"
                    >
                      Keep resident
                    </button>
                    <button
                      type="submit"
                      formAction={removeAction}
                      formNoValidate
                      disabled={busy}
                      className="rounded-lg border border-rose-300/30 bg-rose-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-400 disabled:opacity-50"
                    >
                      {removePending ? "Removing..." : "Remove resident"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {state && !state.success ? (
          <p className="mt-4 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {state.error}
          </p>
        ) : null}

        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy || confirmRemoval}>
            {pending ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
