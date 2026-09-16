"use client";

import { useActionState, useEffect, useState } from "react";
import {
  quickEditCommunityRegistrationResident,
  type RegistrationQuickEditActionResult,
} from "@/features/entry/communityRegistration/review/quickEditActions";
import type { CommunityRegistrationQuickEditResident } from "@/features/entry/communityRegistration/review/quickEditQueries";

type QuickEditResidentsProps = {
  campaignUnitId: string;
  communityId: string;
  residents: CommunityRegistrationQuickEditResident[];
  submissionId: string;
  unitLabel: string;
};

type ResidentRowProps = QuickEditResidentsProps & {
  resident: CommunityRegistrationQuickEditResident;
};

const initialState: RegistrationQuickEditActionResult | null = null;

function ResidentRow({
  campaignUnitId,
  communityId,
  resident,
  submissionId,
}: ResidentRowProps) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(
    quickEditCommunityRegistrationResident,
    initialState,
  );

  useEffect(() => {
    if (state?.success) setEditing(false);
  }, [state]);

  if (!editing) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-black/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">
            {resident.position}. {resident.fullName}
          </p>
          <p className="mt-1 truncate text-xs text-[var(--text-muted)]">
            {resident.email ?? "No email"} · {resident.phone ?? "No phone"}
          </p>
          {state?.success ? (
            <p className="mt-1 text-xs text-emerald-300">{state.message}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/5"
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="rounded-xl border border-violet-400/30 bg-violet-500/[0.05] p-4"
    >
      <input type="hidden" name="community_id" value={communityId} />
      <input type="hidden" name="campaign_unit_id" value={campaignUnitId} />
      <input type="hidden" name="submission_id" value={submissionId} />
      <input type="hidden" name="resident_id" value={resident.id} />

      <div className="grid gap-3 lg:grid-cols-3">
        <label className="space-y-1.5 text-xs font-semibold text-[var(--text-muted)]">
          Full name
          <input
            name="full_name"
            defaultValue={resident.fullName}
            required
            maxLength={160}
            className="w-full rounded-lg border border-[var(--border)] bg-black/20 px-3 py-2 text-sm font-medium text-white outline-none focus:border-violet-400/60"
          />
        </label>
        <label className="space-y-1.5 text-xs font-semibold text-[var(--text-muted)]">
          Email
          <input
            name="email"
            type="email"
            defaultValue={resident.email ?? ""}
            maxLength={254}
            className="w-full rounded-lg border border-[var(--border)] bg-black/20 px-3 py-2 text-sm font-medium text-white outline-none focus:border-violet-400/60"
          />
        </label>
        <label className="space-y-1.5 text-xs font-semibold text-[var(--text-muted)]">
          Phone
          <input
            name="phone"
            defaultValue={resident.phone ?? ""}
            maxLength={32}
            className="w-full rounded-lg border border-[var(--border)] bg-black/20 px-3 py-2 text-sm font-medium text-white outline-none focus:border-violet-400/60"
          />
        </label>
      </div>

      {state && !state.success ? (
        <p className="mt-3 text-xs font-medium text-rose-300">{state.error}</p>
      ) : null}

      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => setEditing(false)}
          className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/5 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-violet-500 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

export function QuickEditResidents(props: QuickEditResidentsProps) {
  if (props.residents.length === 0) return null;

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 lg:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-300">
            Admin quick edit
          </p>
          <h2 className="mt-1 text-sm font-bold text-white">
            Correct resident details · {props.unitLabel}
          </h2>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Fix small data-entry mistakes here. This does not mark the household reviewed or open a correction request.
          </p>
        </div>
        <span className="rounded-full border border-violet-400/25 bg-violet-500/10 px-2.5 py-1 text-[10px] font-bold text-violet-200">
          Submitted only
        </span>
      </div>

      <div className="grid gap-2">
        {props.residents.map((resident) => (
          <ResidentRow key={resident.id} {...props} resident={resident} />
        ))}
      </div>
    </section>
  );
}
