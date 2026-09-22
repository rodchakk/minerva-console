"use client";

import { GitMerge, Home, Mail, Phone, TriangleAlert, X } from "lucide-react";
import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  mergeCommunityRegistrationDuplicateUnits,
  type RegistrationDuplicateActionResult,
} from "@/features/entry/communityRegistration/review/duplicateActions";
import type {
  RegistrationDuplicateCandidate,
  RegistrationDuplicateResident,
  RegistrationDuplicateResidentMatch,
  RegistrationDuplicateUnit,
} from "@/features/entry/communityRegistration/review/duplicateQueries";

const initialState: RegistrationDuplicateActionResult | null = null;

function matchLabel(kind: RegistrationDuplicateResidentMatch["kind"]) {
  switch (kind) {
    case "same_resident":
      return "Resident match";
    case "shared_email":
      return "Shared email";
    case "shared_phone":
      return "Shared phone";
    case "same_name":
      return "Name match";
  }
}

function unitMatchForResident(
  candidate: RegistrationDuplicateCandidate,
  resident: RegistrationDuplicateResident,
) {
  return candidate.residentMatches.find(
    (match) =>
      match.leftResidentId === resident.id || match.rightResidentId === resident.id,
  );
}

function UnitComparisonCard({
  candidate,
  canonicalUnitId,
  onChoose,
  unit,
}: {
  candidate: RegistrationDuplicateCandidate;
  canonicalUnitId: string;
  onChoose: (unitId: string) => void;
  unit: RegistrationDuplicateUnit;
}) {
  const canonical = canonicalUnitId === unit.id;

  return (
    <div
      className={`rounded-xl border p-4 transition ${
        canonical
          ? "border-violet-400/50 bg-violet-500/[0.08] ring-1 ring-inset ring-violet-400/10"
          : "border-[var(--border)] bg-[var(--surface-strong)]"
      }`}
    >
      <label className="flex cursor-pointer items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-violet-500/12 text-violet-200 ring-1 ring-inset ring-violet-400/20">
            <Home className="size-4.5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-white">{unit.label}</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {unit.residents.length} {unit.residents.length === 1 ? "resident" : "residents"}
              {unit.reference ? ` · ${unit.reference}` : ""}
            </p>
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-2 text-xs font-semibold text-slate-200">
          <input
            type="radio"
            name="canonical_unit_choice"
            checked={canonical}
            onChange={() => onChoose(unit.id)}
            className="size-4 accent-violet-500"
          />
          Keep
        </span>
      </label>

      <div className="mt-4 space-y-2">
        {unit.residents.map((resident) => {
          const match = unitMatchForResident(candidate, resident);
          return (
            <div
              key={resident.id}
              className="rounded-lg border border-white/[0.07] bg-black/10 px-3 py-2.5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    {resident.fullName}
                  </p>
                  <div className="mt-1 flex flex-col gap-1 text-[11px] text-[var(--text-muted)]">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <Mail className="size-3 shrink-0" aria-hidden />
                      <span className="truncate">{resident.email ?? "Email missing"}</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Phone className="size-3 shrink-0" aria-hidden />
                      {resident.phone ?? "Phone missing"}
                    </span>
                  </div>
                </div>
                {match ? (
                  <Badge tone={match.kind === "same_resident" ? "success" : "warning"}>
                    {matchLabel(match.kind)}
                  </Badge>
                ) : (
                  <Badge tone="default">Unique</Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DuplicateReviewDialog({
  campaignId,
  candidate,
  communityId,
  onClose,
  selectedUnitId,
  units,
}: {
  campaignId: string;
  candidate: RegistrationDuplicateCandidate;
  communityId: string;
  onClose: () => void;
  selectedUnitId: string;
  units: RegistrationDuplicateUnit[];
}) {
  const router = useRouter();
  const unitA = units.find((unit) => unit.id === candidate.unitAId) ?? null;
  const unitB = units.find((unit) => unit.id === candidate.unitBId) ?? null;
  const defaultCanonical =
    selectedUnitId === candidate.unitAId || selectedUnitId === candidate.unitBId
      ? selectedUnitId
      : candidate.unitAId;
  const [canonicalUnitId, setCanonicalUnitId] = useState(defaultCanonical);
  const [state, formAction, pending] = useActionState(
    mergeCommunityRegistrationDuplicateUnits,
    initialState,
  );

  const duplicateUnitId =
    canonicalUnitId === candidate.unitAId ? candidate.unitBId : candidate.unitAId;
  const canMerge = Boolean(
    unitA &&
      unitB &&
      unitA.status.trim().toLowerCase() === "submitted" &&
      unitB.status.trim().toLowerCase() === "submitted",
  );

  const matchSummary = useMemo(() => {
    const residentMatches = candidate.residentMatches.filter(
      (match) => match.kind === "same_resident",
    ).length;
    const sharedContacts = candidate.residentMatches.filter(
      (match) => match.kind === "shared_email" || match.kind === "shared_phone",
    ).length;
    return { residentMatches, sharedContacts };
  }, [candidate]);

  useEffect(() => {
    if (!state?.success || state.data.kind !== "merged") return;

    const canonicalId = state.data.canonicalUnitId ?? canonicalUnitId;
    onClose();
    router.replace(
      `/products/entry/communities/${encodeURIComponent(
        communityId,
      )}/registration?unit=${encodeURIComponent(canonicalId)}`,
      { scroll: false },
    );
    router.refresh();
  }, [canonicalUnitId, communityId, onClose, router, state]);

  if (!unitA || !unitB) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="grid size-9 place-items-center rounded-full bg-amber-500/12 text-amber-300 ring-1 ring-inset ring-amber-400/20">
                <GitMerge className="size-4" aria-hidden />
              </span>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200">
                  Duplicate review
                </p>
                <h3 className="mt-0.5 text-xl font-semibold text-white">
                  Compare & merge household
                </h3>
              </div>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">
              Choose the unit that should remain. ENTRY will preserve that unit,
              combine unique residents, and only collapse residents when name plus
              email or phone identify the same person. A shared family email alone
              will not merge two people.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 shrink-0 place-items-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] transition hover:bg-white/5 hover:text-white"
            aria-label="Close duplicate comparison"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 [scrollbar-gutter:stable]">
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-amber-400/20 bg-amber-500/[0.07] px-3 py-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-amber-200">
                Confidence
              </p>
              <p className="mt-1 text-sm font-semibold text-white">
                {candidate.confidence === "strong" ? "Strong match" : "Possible match"}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
                Resident matches
              </p>
              <p className="mt-1 text-sm font-semibold text-white">
                {matchSummary.residentMatches}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
                Shared contacts
              </p>
              <p className="mt-1 text-sm font-semibold text-white">
                {matchSummary.sharedContacts}
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <UnitComparisonCard
              candidate={candidate}
              canonicalUnitId={canonicalUnitId}
              onChoose={setCanonicalUnitId}
              unit={unitA}
            />
            <UnitComparisonCard
              candidate={candidate}
              canonicalUnitId={canonicalUnitId}
              onChoose={setCanonicalUnitId}
              unit={unitB}
            />
          </div>

          {!canMerge ? (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-400/20 bg-amber-500/[0.07] px-4 py-3">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-300" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-amber-100">
                  Merge is locked for this pair
                </p>
                <p className="mt-1 text-xs leading-5 text-amber-50/70">
                  Both units must still be in Submitted status. Once review or
                  activation has started, identity resolution must be handled
                  without rewriting registration history.
                </p>
              </div>
            </div>
          ) : null}

          {state && !state.success ? (
            <p className="mt-4 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {state.error}
            </p>
          ) : null}
        </div>

        <form
          action={formAction}
          className="flex shrink-0 flex-col gap-3 border-t border-[var(--border)] bg-[var(--surface)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">
              Keep {canonicalUnitId === unitA.id ? unitA.label : unitB.label}
            </p>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              The other unit stays in audit history as a merged registration.
            </p>
          </div>
          <input type="hidden" name="campaign_id" value={campaignId} />
          <input type="hidden" name="community_id" value={communityId} />
          <input type="hidden" name="canonical_unit_id" value={canonicalUnitId} />
          <input type="hidden" name="duplicate_unit_id" value={duplicateUnitId} />
          <div className="flex shrink-0 gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" className="gap-2" disabled={!canMerge || pending}>
              <GitMerge className="size-4" aria-hidden />
              {pending ? "Merging..." : "Merge units"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
