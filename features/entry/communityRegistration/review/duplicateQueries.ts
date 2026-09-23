"use server";

import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { createAdminClient } from "@/lib/supabase/admin";

const ACTIVE_SUBMISSION_STATUSES = [
  "submitted",
  "edit_enabled",
  "reviewed",
  "confirmed",
  "converted",
] as const;

type DuplicateResolutionRow = {
  canonical_unit_id?: string | null;
  duplicate_unit_id?: string | null;
  metadata?: Record<string, unknown> | null;
  resolution_type?: string | null;
  resolved_at?: string | null;
  resolved_by?: string | null;
  unit_high_id?: string | null;
  unit_low_id?: string | null;
};

export type RegistrationDuplicateResident = {
  email: string | null;
  fullName: string;
  id: string;
  normalizedEmail: string | null;
  normalizedFullName: string;
  normalizedPhone: string | null;
  phone: string | null;
  position: number;
  unitId: string;
};

export type RegistrationDuplicateLifecycle = {
  blocksMerge: boolean;
  label: string;
  reason: string | null;
  step: number;
  totalSteps: number;
};

export type RegistrationDuplicateUnit = {
  canonicalUnitId: string | null;
  id: string;
  label: string;
  lifecycle: RegistrationDuplicateLifecycle;
  patronatoConfirmedAt: string | null;
  reference: string | null;
  residents: RegistrationDuplicateResident[];
  resolutionMetadata: Record<string, unknown> | null;
  resolutionType: "combine_household" | "merged" | "resolved_duplicate" | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  reviewedAt: string | null;
  status: string;
  submittedAt: string | null;
};

export type RegistrationDuplicateResidentMatch = {
  explanation: string;
  kind:
    | "same_resident"
    | "needs_review"
    | "shared_email"
    | "shared_phone"
    | "same_name";
  leftResidentId: string;
  rightResidentId: string;
  score: number;
};

export type RegistrationDuplicateCandidate = {
  confidence: "strong" | "possible";
  emailMatchCount: number;
  id: string;
  nameMatchCount: number;
  phoneMatchCount: number;
  residentMatches: RegistrationDuplicateResidentMatch[];
  score: number;
  unitAId: string;
  unitALabel: string;
  unitBId: string;
  unitBLabel: string;
  unitIdentityMatch: boolean;
};

export type RegistrationDuplicateReviewData = {
  candidateCount: number;
  candidates: RegistrationDuplicateCandidate[];
  duplicateUnitIds: string[];
  mergedUnitIds: string[];
  resolvedUnitIds: string[];
  units: RegistrationDuplicateUnit[];
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function normalizedText(value: unknown) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-HN")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizedEmail(value: unknown) {
  const email = clean(value).toLocaleLowerCase("es-HN");
  return email || null;
}

function normalizedPhone(value: unknown) {
  const digits = clean(value).replace(/\D+/g, "");
  if (digits.length === 11 && digits.startsWith("504")) return digits.slice(3);
  if (digits.length === 12 && digits.startsWith("504")) return digits.slice(3);
  return digits || null;
}

function normalizedUnitIdentity(value: unknown) {
  return normalizedText(value)
    .replace(/^(casa|unidad|apto|apartamento|lote)\s+/i, "")
    .replace(/^#\s*/i, "")
    .trim();
}

function pairKey(leftId: string, rightId: string) {
  return [leftId, rightId].sort().join("::");
}

function nameTokens(value: string) {
  return value.split(" ").filter((token) => token.length > 1);
}

function isExpandedNameMatch(leftName: string, rightName: string) {
  if (!leftName || !rightName || leftName === rightName) return false;
  const left = nameTokens(leftName);
  const right = nameTokens(rightName);
  if (left.length < 2 || right.length < 2) return false;

  const smaller = left.length <= right.length ? left : right;
  const larger = new Set(left.length <= right.length ? right : left);
  return smaller.every((token) => larger.has(token));
}

function isOneEditApart(left: string, right: string) {
  if (left === right) return false;
  if (Math.abs(left.length - right.length) > 1) return false;

  let leftIndex = 0;
  let rightIndex = 0;
  let edits = 0;

  while (leftIndex < left.length && rightIndex < right.length) {
    if (left[leftIndex] === right[rightIndex]) {
      leftIndex += 1;
      rightIndex += 1;
      continue;
    }

    edits += 1;
    if (edits > 1) return false;

    if (left.length > right.length) leftIndex += 1;
    else if (right.length > left.length) rightIndex += 1;
    else {
      leftIndex += 1;
      rightIndex += 1;
    }
  }

  if (leftIndex < left.length || rightIndex < right.length) edits += 1;
  return edits === 1;
}

function isTinyNameVariant(leftName: string, rightName: string) {
  const left = nameTokens(leftName);
  const right = nameTokens(rightName);
  if (left.length < 2 || left.length !== right.length) return false;

  let tinyDifferences = 0;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] === right[index]) continue;
    if (!isOneEditApart(left[index], right[index])) return false;
    tinyDifferences += 1;
  }

  return tinyDifferences === 1;
}

function residentMatchScore(
  left: RegistrationDuplicateResident,
  right: RegistrationDuplicateResident,
): RegistrationDuplicateResidentMatch | null {
  const sameName =
    Boolean(left.normalizedFullName) &&
    left.normalizedFullName === right.normalizedFullName;
  const expandedName = isExpandedNameMatch(
    left.normalizedFullName,
    right.normalizedFullName,
  );
  const sameEmail =
    Boolean(left.normalizedEmail) &&
    left.normalizedEmail === right.normalizedEmail;
  const samePhone =
    Boolean(left.normalizedPhone) &&
    left.normalizedPhone === right.normalizedPhone;
  const tinyNameVariant = isTinyNameVariant(
    left.normalizedFullName,
    right.normalizedFullName,
  );

  if (sameName && (sameEmail || samePhone)) {
    return {
      kind: "same_resident",
      explanation:
        sameEmail && samePhone
          ? "Matched by normalized name, email, and phone"
          : sameEmail
            ? "Matched by normalized name and email"
            : "Matched by normalized name and phone",
      leftResidentId: left.id,
      rightResidentId: right.id,
      score: 8 + (sameEmail && samePhone ? 2 : 0),
    };
  }

  if ((expandedName || tinyNameVariant) && sameEmail && samePhone) {
    return {
      kind: "same_resident",
      explanation: tinyNameVariant
        ? "Matched by near-identical names with the same email and phone"
        : "Matched by compatible names with the same email and phone",
      leftResidentId: left.id,
      rightResidentId: right.id,
      score: 9,
    };
  }

  if (expandedName && (sameEmail || samePhone)) {
    return {
      kind: "needs_review",
      explanation: sameEmail
        ? "Compatible names share an email; operator must confirm"
        : "Compatible names share a phone; operator must confirm",
      leftResidentId: left.id,
      rightResidentId: right.id,
      score: sameEmail ? 6 : 5,
    };
  }

  if (sameEmail) {
    return {
      kind: "shared_email",
      explanation: "Shared email only; not enough to merge residents",
      leftResidentId: left.id,
      rightResidentId: right.id,
      score: 4,
    };
  }

  if (samePhone) {
    return {
      kind: "shared_phone",
      explanation: "Shared phone only; not enough to merge residents",
      leftResidentId: left.id,
      rightResidentId: right.id,
      score: 3,
    };
  }

  if (sameName) {
    return {
      kind: "same_name",
      explanation: "Same normalized name without a matching contact",
      leftResidentId: left.id,
      rightResidentId: right.id,
      score: 2,
    };
  }

  return null;
}

function buildCandidate(
  unitA: RegistrationDuplicateUnit,
  unitB: RegistrationDuplicateUnit,
): RegistrationDuplicateCandidate | null {
  const unitIdentityMatch =
    normalizedUnitIdentity(unitA.label).length > 0 &&
    normalizedUnitIdentity(unitA.label) === normalizedUnitIdentity(unitB.label);

  const residentMatches: RegistrationDuplicateResidentMatch[] = [];
  const usedRightResidents = new Set<string>();

  for (const left of unitA.residents) {
    const ranked = unitB.residents
      .filter((right) => !usedRightResidents.has(right.id))
      .map((right) => residentMatchScore(left, right))
      .filter(
        (match): match is RegistrationDuplicateResidentMatch => match !== null,
      )
      .sort((leftMatch, rightMatch) => rightMatch.score - leftMatch.score);

    const best = ranked[0];
    if (!best) continue;

    residentMatches.push(best);
    usedRightResidents.add(best.rightResidentId);
  }

  const sameResidentCount = residentMatches.filter(
    (match) => match.kind === "same_resident",
  ).length;
  const needsReviewCount = residentMatches.filter(
    (match) => match.kind === "needs_review",
  ).length;
  const rightEmails = new Set(
    unitB.residents
      .map((resident) => resident.normalizedEmail)
      .filter((value): value is string => Boolean(value)),
  );
  const rightPhones = new Set(
    unitB.residents
      .map((resident) => resident.normalizedPhone)
      .filter((value): value is string => Boolean(value)),
  );
  const rightNames = new Set(
    unitB.residents
      .map((resident) => resident.normalizedFullName)
      .filter(Boolean),
  );
  const emailMatchCount = new Set(
    unitA.residents
      .map((resident) => resident.normalizedEmail)
      .filter(
        (value): value is string => Boolean(value) && rightEmails.has(value as string),
      ),
  ).size;
  const phoneMatchCount = new Set(
    unitA.residents
      .map((resident) => resident.normalizedPhone)
      .filter(
        (value): value is string => Boolean(value) && rightPhones.has(value as string),
      ),
  ).size;
  const nameMatchCount = new Set(
    unitA.residents
      .map((resident) => resident.normalizedFullName)
      .filter((value) => Boolean(value) && rightNames.has(value)),
  ).size;

  const evidenceScore = residentMatches.reduce(
    (total, match) => total + match.score,
    0,
  );
  const score = evidenceScore + (unitIdentityMatch ? 6 : 0);

  // A shared family email by itself is not enough to call two units duplicates.
  // Require a canonical unit-label collision, a same-person match, or multiple
  // independent signals before surfacing the candidate.
  const hasIndependentSignals =
    sameResidentCount > 0 ||
    needsReviewCount > 0 ||
    unitIdentityMatch ||
    (emailMatchCount > 0 && (nameMatchCount > 0 || phoneMatchCount > 0)) ||
    (phoneMatchCount > 0 && nameMatchCount > 0);

  if (!hasIndependentSignals || score < 6) return null;

  return {
    confidence: score >= 10 || sameResidentCount >= 2 ? "strong" : "possible",
    emailMatchCount,
    id: pairKey(unitA.id, unitB.id),
    nameMatchCount,
    phoneMatchCount,
    residentMatches,
    score,
    unitAId: unitA.id,
    unitALabel: unitA.label,
    unitBId: unitB.id,
    unitBLabel: unitB.label,
    unitIdentityMatch,
  };
}

export async function getCommunityRegistrationDuplicateReviewData(
  campaignId: string,
  communityId: string,
): Promise<RegistrationDuplicateReviewData> {
  await requireSuperadmin();

  if (!campaignId.trim() || !communityId.trim()) {
    return {
      candidateCount: 0,
      candidates: [],
      duplicateUnitIds: [],
      mergedUnitIds: [],
      resolvedUnitIds: [],
      units: [],
    };
  }

  const supabase = createAdminClient();
  const [unitsResponse, submissionsResponse] = await Promise.all([
    supabase
      .from("community_registration_units")
      .select(
        "id,unit_label_snapshot,unit_reference_snapshot,status,last_submitted_at,reviewed_at,patronato_confirmed_at",
      )
      .eq("campaign_id", campaignId)
      .eq("community_id", communityId),
    supabase
      .from("community_registration_submissions")
      .select("id,campaign_unit_id,status,version_number,submitted_at")
      .eq("campaign_id", campaignId)
      .eq("community_id", communityId)
      .in("status", [...ACTIVE_SUBMISSION_STATUSES])
      .order("version_number", { ascending: false }),
  ]);

  if (
    unitsResponse.error ||
    submissionsResponse.error ||
    !Array.isArray(unitsResponse.data) ||
    !Array.isArray(submissionsResponse.data)
  ) {
    return {
      candidateCount: 0,
      candidates: [],
      duplicateUnitIds: [],
      mergedUnitIds: [],
      resolvedUnitIds: [],
      units: [],
    };
  }

  const latestSubmissionByUnit = new Map<string, string>();
  const latestSubmittedAtByUnit = new Map<string, string | null>();
  for (const rawSubmission of submissionsResponse.data) {
    const row = rawSubmission as Record<string, unknown>;
    const unitId = clean(row.campaign_unit_id);
    const submissionId = clean(row.id);
    if (unitId && submissionId && !latestSubmissionByUnit.has(unitId)) {
      latestSubmissionByUnit.set(unitId, submissionId);
      latestSubmittedAtByUnit.set(unitId, clean(row.submitted_at) || null);
    }
  }

  const submissionIds = Array.from(latestSubmissionByUnit.values());
  const residentsResponse =
    submissionIds.length > 0
      ? await supabase
          .from("community_registration_residents")
          .select(
            "id,submission_id,campaign_unit_id,position,full_name,email,phone,normalized_full_name,normalized_email,normalized_phone",
          )
          .in("submission_id", submissionIds)
      : { data: [], error: null };

  if (residentsResponse.error || !Array.isArray(residentsResponse.data)) {
    return {
      candidateCount: 0,
      candidates: [],
      duplicateUnitIds: [],
      mergedUnitIds: [],
      resolvedUnitIds: [],
      units: [],
    };
  }

  const residentIds = residentsResponse.data
    .map((rawResident) => clean((rawResident as Record<string, unknown>).id))
    .filter(Boolean);
  const activationResponse =
    residentIds.length > 0
      ? await supabase
          .from("resident_activation_queue")
          .select("community_registration_resident_id,status")
          .in("community_registration_resident_id", residentIds)
          .eq("status", "activated")
      : { data: [], error: null };
  const activatedResidentIds = new Set(
    !activationResponse.error && Array.isArray(activationResponse.data)
      ? activationResponse.data
          .map((row) =>
            clean(
              (row as Record<string, unknown>).community_registration_resident_id,
            ),
          )
          .filter(Boolean)
      : [],
  );

  // This table is introduced by the duplicate-resolution migration. Keeping
  // this read soft-failing lets Vercel previews render before the migration is
  // applied to the shared backend.
  let resolutions: DuplicateResolutionRow[] = [];
  try {
    const resolutionResponse = await supabase
      .from("community_registration_duplicate_resolutions")
      .select(
        "unit_low_id,unit_high_id,resolution_type,canonical_unit_id,duplicate_unit_id,metadata,resolved_by,resolved_at",
      )
      .eq("campaign_id", campaignId)
      .eq("community_id", communityId);

    if (!resolutionResponse.error && Array.isArray(resolutionResponse.data)) {
      resolutions = resolutionResponse.data as DuplicateResolutionRow[];
    }
  } catch {
    resolutions = [];
  }

  const mergedUnitIds = Array.from(
    new Set(
      resolutions
        .filter((row) => row.resolution_type === "merged")
        .map((row) => clean(row.duplicate_unit_id))
        .filter(Boolean),
    ),
  );
  const resolvedUnitIds = Array.from(
    new Set(
      resolutions
        .filter((row) =>
          ["combine_household", "resolved_duplicate"].includes(
            clean(row.resolution_type),
          ),
        )
        .map((row) => clean(row.duplicate_unit_id))
        .filter(Boolean),
    ),
  );
  const resolutionByDuplicateUnitId = new Map(
    resolutions
      .filter((row) =>
        ["merged", "resolved_duplicate"].includes(clean(row.resolution_type)),
      )
      .map((row) => [clean(row.duplicate_unit_id), row] as const)
      .filter(([unitId]) => Boolean(unitId)),
  );
  const resolutionByCombinedUnitId = new Map(
    resolutions
      .filter((row) =>
        ["combine_household", "resolved_duplicate", "merged"].includes(
          clean(row.resolution_type),
        ),
      )
      .map((row) => [clean(row.duplicate_unit_id), row] as const)
      .filter(([unitId]) => Boolean(unitId)),
  );
  const hiddenPairs = new Set(
    resolutions
      .filter((row) =>
        ["combine_household", "merged", "resolved_duplicate", "dismissed"].includes(
          clean(row.resolution_type),
        ),
      )
      .map((row) => pairKey(clean(row.unit_low_id), clean(row.unit_high_id))),
  );

  const residentsByUnit = new Map<string, RegistrationDuplicateResident[]>();
  const activatedUnitIds = new Set<string>();
  for (const rawResident of residentsResponse.data) {
    const row = rawResident as Record<string, unknown>;
    const unitId = clean(row.campaign_unit_id);
    const id = clean(row.id);
    if (!unitId || !id) continue;

    const resident: RegistrationDuplicateResident = {
      email: clean(row.email) || null,
      fullName: clean(row.full_name),
      id,
      normalizedEmail:
        normalizedEmail(row.normalized_email) ?? normalizedEmail(row.email),
      normalizedFullName:
        normalizedText(row.normalized_full_name || row.full_name),
      normalizedPhone:
        normalizedPhone(row.normalized_phone) ?? normalizedPhone(row.phone),
      phone: clean(row.phone) || null,
      position: Number(row.position ?? 0),
      unitId,
    };

    if (activatedResidentIds.has(id)) {
      activatedUnitIds.add(unitId);
    }

    const current = residentsByUnit.get(unitId) ?? [];
    current.push(resident);
    residentsByUnit.set(unitId, current);
  }

  const units: RegistrationDuplicateUnit[] = unitsResponse.data
    .map((rawUnit) => {
      const row = rawUnit as Record<string, unknown>;
      const id = clean(row.id);
      if (!id || mergedUnitIds.includes(id)) return null;
      const resolution =
        resolutionByCombinedUnitId.get(id) ?? resolutionByDuplicateUnitId.get(id);
      const resolutionType =
        resolution?.resolution_type === "combine_household"
          ? "combine_household"
          : resolution?.resolution_type === "resolved_duplicate"
          ? "resolved_duplicate"
          : resolution?.resolution_type === "merged"
            ? "merged"
            : null;

      return {
        canonicalUnitId: clean(resolution?.canonical_unit_id) || null,
        id,
        label: clean(row.unit_label_snapshot),
        lifecycle: lifecycleForUnit({
          activated: activatedUnitIds.has(id),
          label: clean(row.unit_label_snapshot),
          patronatoConfirmedAt: clean(row.patronato_confirmed_at) || null,
          reviewedAt: clean(row.reviewed_at) || null,
          status: clean(row.status),
          submittedAt:
            latestSubmittedAtByUnit.get(id) ??
            (clean(row.last_submitted_at) || null),
        }),
        patronatoConfirmedAt: clean(row.patronato_confirmed_at) || null,
        reference: clean(row.unit_reference_snapshot) || null,
        residents: (residentsByUnit.get(id) ?? []).sort(
          (left, right) => left.position - right.position,
        ),
        resolutionMetadata:
          resolution?.metadata && typeof resolution.metadata === "object"
            ? resolution.metadata
            : null,
        resolutionType,
        resolvedAt: clean(resolution?.resolved_at) || null,
        resolvedBy: clean(resolution?.resolved_by) || null,
        reviewedAt: clean(row.reviewed_at) || null,
        status: clean(row.status),
        submittedAt:
          latestSubmittedAtByUnit.get(id) ??
          (clean(row.last_submitted_at) || null),
      } satisfies RegistrationDuplicateUnit;
    })
    .filter((unit): unit is RegistrationDuplicateUnit => unit !== null)
    .filter(
      (unit) =>
        unit.status !== "unregistered" &&
        unit.residents.length > 0 &&
        (unit.status !== "merged" ||
          unit.resolutionType === "combine_household" ||
          unit.resolutionType === "resolved_duplicate"),
    );

  const candidates: RegistrationDuplicateCandidate[] = [];
  for (let leftIndex = 0; leftIndex < units.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < units.length;
      rightIndex += 1
    ) {
      const left = units[leftIndex];
      const right = units[rightIndex];
      const key = pairKey(left.id, right.id);
      if (hiddenPairs.has(key)) continue;

      const candidate = buildCandidate(left, right);
      if (candidate) candidates.push(candidate);
    }
  }

  candidates.sort((left, right) => {
    if (left.confidence !== right.confidence) {
      return left.confidence === "strong" ? -1 : 1;
    }
    return right.score - left.score;
  });

  const duplicateUnitIds = Array.from(
    new Set(candidates.flatMap((candidate) => [candidate.unitAId, candidate.unitBId])),
  );

  return {
    candidateCount: candidates.length,
    candidates,
    duplicateUnitIds,
    mergedUnitIds,
    resolvedUnitIds,
    units,
  };
}

function lifecycleForUnit(input: {
  activated: boolean;
  label: string;
  patronatoConfirmedAt: string | null;
  reviewedAt: string | null;
  status: string;
  submittedAt: string | null;
}): RegistrationDuplicateLifecycle {
  const normalized = input.status.trim().toLowerCase();
  const prepared =
    input.activated || normalized === "processed" || normalized === "converted";
  const confirmed = prepared || normalized === "confirmed" || Boolean(input.patronatoConfirmedAt);
  const reviewed = confirmed || normalized === "reviewed" || Boolean(input.reviewedAt);
  const submitted =
    reviewed ||
    ["submitted", "edit_enabled", "needs_correction"].includes(normalized) ||
    Boolean(input.submittedAt);

  const step = prepared ? 4 : confirmed ? 3 : reviewed ? 2 : submitted ? 1 : 0;
  const label =
    input.activated
      ? "Activated"
      : prepared
      ? "Prepared for activation"
      : confirmed
        ? "Patronato confirmed"
        : reviewed
          ? "Reviewed"
          : submitted
            ? "Submitted"
            : "Not submitted";
  const blocksMerge = normalized !== "submitted";

  return {
    blocksMerge,
    label,
    reason: blocksMerge
      ? `Merge is locked because ${input.label || "this unit"} has already reached ${label}.`
      : null,
    step,
    totalSteps: 4,
  };
}
