"use client";

import {
  ArrowRight,
  CheckCircle2,
  GitMerge,
  Home,
  Mail,
  Phone,
  TriangleAlert,
  Users,
  X,
} from "lucide-react";
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

type ResidentDecision = "merge" | "keep_separate";

type ResolvedResident = {
  conflicts: string[];
  email: string | null;
  fullName: string;
  phone: string | null;
  recoveredFields: number;
};

function clean(value: string | null | undefined) {
  return String(value ?? "").trim();
}

function normalizedText(value: string | null | undefined) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-HN")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizedEmail(value: string | null | undefined) {
  return clean(value).toLocaleLowerCase("es-HN");
}

function normalizedPhone(value: string | null | undefined) {
  const digits = clean(value).replace(/\D+/g, "");
  if (digits.length === 11 && digits.startsWith("504")) return digits.slice(3);
  if (digits.length === 12 && digits.startsWith("504")) return digits.slice(3);
  return digits;
}

function fieldValue(
  canonical: string | null,
  duplicate: string | null,
  normalize: (value: string | null | undefined) => string,
) {
  const canonicalValue = clean(canonical) || null;
  const duplicateValue = clean(duplicate) || null;

  if (!canonicalValue && duplicateValue) {
    return {
      conflict: false,
      recovered: true,
      value: duplicateValue,
    };
  }

  if (canonicalValue && !duplicateValue) {
    return {
      conflict: false,
      recovered: false,
      value: canonicalValue,
    };
  }

  if (!canonicalValue && !duplicateValue) {
    return {
      conflict: false,
      recovered: false,
      value: null,
    };
  }

  if (normalize(canonicalValue) === normalize(duplicateValue)) {
    return {
      conflict: false,
      recovered: false,
      value: canonicalValue,
    };
  }

  return {
    conflict: true,
    recovered: false,
    value: canonicalValue,
  };
}

function isCompatibleName(left: string, right: string) {
  const leftNormalized = normalizedText(left);
  const rightNormalized = normalizedText(right);
  if (!leftNormalized || !rightNormalized) return false;
  if (leftNormalized === rightNormalized) return true;

  const leftTokens = leftNormalized.split(" ");
  const rightTokens = rightNormalized.split(" ");
  const smaller = leftTokens.length <= rightTokens.length ? leftTokens : rightTokens;
  const larger = new Set(leftTokens.length <= rightTokens.length ? rightTokens : leftTokens);
  return smaller.length >= 2 && smaller.every((token) => larger.has(token));
}

function resolvedResident(
  canonical: RegistrationDuplicateResident,
  duplicate: RegistrationDuplicateResident,
): ResolvedResident {
  const canonicalName = clean(canonical.fullName);
  const duplicateName = clean(duplicate.fullName);
  const fullName =
    isCompatibleName(canonicalName, duplicateName) &&
    normalizedText(duplicateName).length > normalizedText(canonicalName).length
      ? duplicateName
      : canonicalName || duplicateName;
  const email = fieldValue(canonical.email, duplicate.email, normalizedEmail);
  const phone = fieldValue(canonical.phone, duplicate.phone, normalizedPhone);
  const conflicts = [
    email.conflict ? "Email conflict" : null,
    phone.conflict ? "Phone conflict" : null,
  ].filter((value): value is string => value !== null);

  return {
    conflicts,
    email: email.value,
    fullName,
    phone: phone.value,
    recoveredFields: Number(email.recovered) + Number(phone.recovered),
  };
}

function matchLabel(kind: RegistrationDuplicateResidentMatch["kind"]) {
  switch (kind) {
    case "same_resident":
      return "Resident match";
    case "needs_review":
      return "Needs review";
    case "shared_email":
      return "Shared email";
    case "shared_phone":
      return "Shared phone";
    case "same_name":
      return "Name match";
  }
}

function statusTone(status: string): "default" | "success" | "warning" | "info" {
  const normalized = status.trim().toLowerCase();
  if (["reviewed", "confirmed", "processed", "converted"].includes(normalized)) {
    return "success";
  }
  if (normalized === "submitted") return "info";
  if (["needs_correction", "edit_enabled"].includes(normalized)) return "warning";
  return "default";
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

      <div className="mt-4 rounded-lg border border-white/[0.07] bg-black/10 px-3 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge tone={statusTone(unit.status)}>{unit.lifecycle.label}</Badge>
          <span className="text-xs font-semibold text-slate-200">
            Step {unit.lifecycle.step || 1} of {unit.lifecycle.totalSteps} - {unit.lifecycle.label}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-1">
          {["Submitted", "Reviewed", "Patronato", "Activation"].map((label, index) => (
            <div key={label} className="min-w-0">
              <div
                className={`h-1.5 rounded-full ${
                  unit.lifecycle.step >= index + 1 ? "bg-emerald-400" : "bg-white/10"
                }`}
              />
              <p className="mt-1 truncate text-[10px] text-[var(--text-muted)]">
                {label}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {unit.residents.map((resident) => {
          const match = unitMatchForResident(candidate, resident);
          const warning =
            match?.kind === "shared_email" ||
            match?.kind === "shared_phone" ||
            match?.kind === "needs_review";
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
                  <Badge tone={match.kind === "same_resident" ? "success" : warning ? "warning" : "default"}>
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

function ResidentResultPreview({ result }: { result: ResolvedResident }) {
  return (
    <div className="mt-3 rounded-lg border border-emerald-400/15 bg-emerald-500/[0.06] px-3 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200">
        Resulting resident
      </p>
      <div className="mt-2 grid gap-2 text-xs sm:grid-cols-3">
        <p>
          <span className="block text-[var(--text-muted)]">Name</span>
          <span className="font-semibold text-white">{result.fullName}</span>
        </p>
        <p>
          <span className="block text-[var(--text-muted)]">Email</span>
          <span className="font-semibold text-white">{result.email ?? "Email missing"}</span>
        </p>
        <p>
          <span className="block text-[var(--text-muted)]">Phone</span>
          <span className="font-semibold text-white">{result.phone ?? "Phone missing"}</span>
        </p>
      </div>
      {result.conflicts.length > 0 ? (
        <p className="mt-2 text-xs font-semibold text-amber-200">
          {result.conflicts.join(", ")} must be resolved before merge.
        </p>
      ) : null}
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
  const [decisions, setDecisions] = useState<Record<string, ResidentDecision>>({});
  const [state, formAction, pending] = useActionState(
    mergeCommunityRegistrationDuplicateUnits,
    initialState,
  );

  const duplicateUnitId =
    canonicalUnitId === candidate.unitAId ? candidate.unitBId : candidate.unitAId;

  const residentById = useMemo(() => {
    const map = new Map<string, RegistrationDuplicateResident>();
    for (const unit of [unitA, unitB]) {
      for (const resident of unit?.residents ?? []) map.set(resident.id, resident);
    }
    return map;
  }, [unitA, unitB]);

  const reviewMatches = useMemo(
    () =>
      candidate.residentMatches
        .filter((match) => match.kind === "same_resident" || match.kind === "needs_review")
        .map((match) => {
          const left = residentById.get(match.leftResidentId) ?? null;
          const right = residentById.get(match.rightResidentId) ?? null;
          if (!left || !right) return null;
          const decisionKey = `${match.leftResidentId}:${match.rightResidentId}`;
          const decision =
            match.kind === "same_resident"
              ? "merge"
              : decisions[decisionKey] ?? null;
          const canonicalResident =
            canonicalUnitId === candidate.unitAId ? left : right;
          const duplicateResident =
            canonicalUnitId === candidate.unitAId ? right : left;
          const result =
            decision === "merge"
              ? resolvedResident(canonicalResident, duplicateResident)
              : null;

          return {
            canonicalResident,
            decision,
            decisionKey,
            duplicateResident,
            left,
            match,
            result,
            right,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null),
    [candidate, canonicalUnitId, decisions, residentById],
  );

  const contactOnlyMatches = useMemo(
    () =>
      candidate.residentMatches
        .filter(
          (match) =>
            match.kind === "shared_email" ||
            match.kind === "shared_phone" ||
            match.kind === "same_name",
        )
        .map((match) => ({
          left: residentById.get(match.leftResidentId) ?? null,
          match,
          right: residentById.get(match.rightResidentId) ?? null,
        }))
        .filter((item) => item.left && item.right),
    [candidate.residentMatches, residentById],
  );

  const matchedResidentIds = new Set(
    candidate.residentMatches.flatMap((match) => [
      match.leftResidentId,
      match.rightResidentId,
    ]),
  );
  const unmatchedResidents = [...(unitA?.residents ?? []), ...(unitB?.residents ?? [])].filter(
    (resident) => !matchedResidentIds.has(resident.id),
  );
  const unresolvedCount = reviewMatches.filter(
    (item) => item.match.kind === "needs_review" && item.decision === null,
  ).length;
  const conflictCount = reviewMatches.reduce(
    (total, item) => total + (item.result?.conflicts.length ?? 0),
    0,
  );
  const duplicateResidentsUnified = reviewMatches.filter(
    (item) => item.decision === "merge",
  ).length;
  const recoveredFieldCount = reviewMatches.reduce(
    (total, item) => total + (item.result?.recoveredFields ?? 0),
    0,
  );
  const residentsAfterMerge =
    (unitA?.residents.length ?? 0) +
    (unitB?.residents.length ?? 0) -
    duplicateResidentsUnified;
  const lifecycleBlockers = [unitA, unitB]
    .filter((unit): unit is RegistrationDuplicateUnit => Boolean(unit?.lifecycle.blocksMerge))
    .map((unit) => unit.lifecycle.reason)
    .filter((reason): reason is string => Boolean(reason));
  const canMerge = Boolean(
    unitA &&
      unitB &&
      lifecycleBlockers.length === 0 &&
      unresolvedCount === 0 &&
      conflictCount === 0,
  );

  const mergePlan = useMemo(
    () => ({
      conflicts: conflictCount,
      decisions: reviewMatches.map((item) => ({
        canonicalResidentId: item.canonicalResident.id,
        decision: item.decision ?? "unresolved",
        duplicateResidentId: item.duplicateResident.id,
        evidence: item.match.kind,
        explanation: item.match.explanation,
        leftResidentId: item.left.id,
        resultEmail: item.result?.email ?? null,
        resultFullName: item.result?.fullName ?? null,
        resultPhone: item.result?.phone ?? null,
        rightResidentId: item.right.id,
      })),
      hasUnresolved: unresolvedCount > 0,
      recoveredFieldCount,
      residentsAfterMerge,
      unifiedResidentCount: duplicateResidentsUnified,
    }),
    [
      conflictCount,
      duplicateResidentsUnified,
      recoveredFieldCount,
      residentsAfterMerge,
      reviewMatches,
      unresolvedCount,
    ],
  );

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

  const canonicalUnit = canonicalUnitId === unitA.id ? unitA : unitB;
  const duplicateUnit = canonicalUnitId === unitA.id ? unitB : unitA;

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
              Choose the unit that should remain, then review resident matches.
              Shared email or phone alone is preserved as evidence, but it will not
              merge two residents without a confirmed same-person decision.
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
                {duplicateResidentsUnified}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
                Needs review
              </p>
              <p className="mt-1 text-sm font-semibold text-white">{unresolvedCount}</p>
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

          <section className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-200">
                  Resolve resident matches
                </p>
                <h4 className="mt-1 text-base font-semibold text-white">
                  Resident-level resolution
                </h4>
              </div>
              <Badge tone={unresolvedCount > 0 ? "warning" : "success"}>
                {unresolvedCount > 0 ? `${unresolvedCount} unresolved` : "Resolved"}
              </Badge>
            </div>

            <div className="mt-4 space-y-3">
              {reviewMatches.map((item) => (
                <div
                  key={item.decisionKey}
                  className="rounded-lg border border-white/[0.07] bg-black/10 px-3 py-3"
                >
                  <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">
                        {item.left.fullName}
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        {item.left.email ?? "Email missing"} · {item.left.phone ?? "Phone missing"}
                      </p>
                    </div>
                    <ArrowRight className="hidden size-4 text-[var(--text-muted)] lg:block" aria-hidden />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">
                        {item.right.fullName}
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        {item.right.email ?? "Email missing"} · {item.right.phone ?? "Phone missing"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge tone={item.match.kind === "same_resident" ? "success" : "warning"}>
                      {item.match.kind === "same_resident" ? "Same person" : "Needs review"}
                    </Badge>
                    <span className="text-xs text-[var(--text-muted)]">
                      {item.match.explanation}
                    </span>
                  </div>

                  {item.match.kind === "needs_review" ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant={item.decision === "merge" ? "primary" : "secondary"}
                        onClick={() =>
                          setDecisions((current) => ({
                            ...current,
                            [item.decisionKey]: "merge",
                          }))
                        }
                      >
                        Merge as same person
                      </Button>
                      <Button
                        type="button"
                        variant={item.decision === "keep_separate" ? "primary" : "secondary"}
                        onClick={() =>
                          setDecisions((current) => ({
                            ...current,
                            [item.decisionKey]: "keep_separate",
                          }))
                        }
                      >
                        Keep separate
                      </Button>
                    </div>
                  ) : null}

                  {item.result ? <ResidentResultPreview result={item.result} /> : null}
                </div>
              ))}

              {contactOnlyMatches.length > 0 ? (
                <div className="rounded-lg border border-white/[0.07] bg-black/10 px-3 py-3">
                  <div className="flex items-start gap-2">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-300" aria-hidden />
                    <div>
                      <p className="text-sm font-semibold text-white">
                        Contact overlap kept separate
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                        Shared email, shared phone, or name-only evidence is shown
                        for review but does not auto-collapse residents.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {unmatchedResidents.length > 0 ? (
                <div className="rounded-lg border border-white/[0.07] bg-black/10 px-3 py-3">
                  <div className="flex items-start gap-2">
                    <Users className="mt-0.5 size-4 shrink-0 text-slate-300" aria-hidden />
                    <div>
                      <p className="text-sm font-semibold text-white">No match</p>
                      <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                        {unmatchedResidents.length} resident
                        {unmatchedResidents.length === 1 ? "" : "s"} will remain separate.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          <section className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-200">
              Merge result
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-4">
              <div>
                <p className="text-[11px] text-[var(--text-muted)]">Keep</p>
                <p className="mt-1 truncate text-sm font-semibold text-white">
                  {canonicalUnit.label}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-[var(--text-muted)]">Audit history</p>
                <p className="mt-1 truncate text-sm font-semibold text-white">
                  {duplicateUnit.label}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-[var(--text-muted)]">Residents after merge</p>
                <p className="mt-1 text-sm font-semibold text-white">
                  {residentsAfterMerge}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-[var(--text-muted)]">Missing fields recovered</p>
                <p className="mt-1 text-sm font-semibold text-white">
                  {recoveredFieldCount}
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-white/10 px-2.5 py-1 text-slate-200">
                Duplicate residents unified: {duplicateResidentsUnified}
              </span>
              <span className="rounded-full border border-white/10 px-2.5 py-1 text-slate-200">
                Conflicts: {conflictCount}
              </span>
            </div>
          </section>

          {!canMerge ? (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-400/20 bg-amber-500/[0.07] px-4 py-3">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-300" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-amber-100">
                  Merge is locked for this pair
                </p>
                <div className="mt-1 space-y-1 text-xs leading-5 text-amber-50/70">
                  {lifecycleBlockers.length > 0
                    ? lifecycleBlockers.map((reason) => <p key={reason}>{reason}</p>)
                    : null}
                  {unresolvedCount > 0 ? (
                    <p>Merge is locked because resident decisions are still unresolved.</p>
                  ) : null}
                  {conflictCount > 0 ? (
                    <p>Merge is locked because conflicting resident contact data needs review.</p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.07] px-4 py-3">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-300" aria-hidden />
              <p className="text-sm font-semibold text-emerald-100">
                Resident decisions are ready for merge.
              </p>
            </div>
          )}

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
              Keep {canonicalUnit.label}
            </p>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              {duplicateUnit.label} stays traceable as merged registration history.
            </p>
          </div>
          <input type="hidden" name="campaign_id" value={campaignId} />
          <input type="hidden" name="community_id" value={communityId} />
          <input type="hidden" name="canonical_unit_id" value={canonicalUnitId} />
          <input type="hidden" name="duplicate_unit_id" value={duplicateUnitId} />
          <input type="hidden" name="resident_merge_plan" value={JSON.stringify(mergePlan)} />
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
