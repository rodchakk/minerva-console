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
  resolution_type?: string | null;
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

export type RegistrationDuplicateUnit = {
  id: string;
  label: string;
  reference: string | null;
  residents: RegistrationDuplicateResident[];
  status: string;
};

export type RegistrationDuplicateResidentMatch = {
  kind: "same_resident" | "shared_email" | "shared_phone" | "same_name";
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

function normalizedUnitIdentity(value: unknown) {
  return normalizedText(value)
    .replace(/^(casa|unidad|apto|apartamento|lote)\s+/i, "")
    .replace(/^#\s*/i, "")
    .trim();
}

function pairKey(leftId: string, rightId: string) {
  return [leftId, rightId].sort().join("::");
}

function residentMatchScore(
  left: RegistrationDuplicateResident,
  right: RegistrationDuplicateResident,
): RegistrationDuplicateResidentMatch | null {
  const sameName =
    Boolean(left.normalizedFullName) &&
    left.normalizedFullName === right.normalizedFullName;
  const sameEmail =
    Boolean(left.normalizedEmail) &&
    left.normalizedEmail === right.normalizedEmail;
  const samePhone =
    Boolean(left.normalizedPhone) &&
    left.normalizedPhone === right.normalizedPhone;

  if (sameName && (sameEmail || samePhone)) {
    return {
      kind: "same_resident",
      leftResidentId: left.id,
      rightResidentId: right.id,
      score: 8 + (sameEmail && samePhone ? 2 : 0),
    };
  }

  if (sameEmail) {
    return {
      kind: "shared_email",
      leftResidentId: left.id,
      rightResidentId: right.id,
      score: 4,
    };
  }

  if (samePhone) {
    return {
      kind: "shared_phone",
      leftResidentId: left.id,
      rightResidentId: right.id,
      score: 3,
    };
  }

  if (sameName) {
    return {
      kind: "same_name",
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
      units: [],
    };
  }

  const supabase = createAdminClient();
  const [unitsResponse, submissionsResponse] = await Promise.all([
    supabase
      .from("community_registration_units")
      .select("id,unit_label_snapshot,unit_reference_snapshot,status")
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
      units: [],
    };
  }

  const latestSubmissionByUnit = new Map<string, string>();
  for (const rawSubmission of submissionsResponse.data) {
    const row = rawSubmission as Record<string, unknown>;
    const unitId = clean(row.campaign_unit_id);
    const submissionId = clean(row.id);
    if (unitId && submissionId && !latestSubmissionByUnit.has(unitId)) {
      latestSubmissionByUnit.set(unitId, submissionId);
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
      units: [],
    };
  }

  // This table is introduced by the duplicate-resolution migration. Keeping
  // this read soft-failing lets Vercel previews render before the migration is
  // applied to the shared backend.
  let resolutions: DuplicateResolutionRow[] = [];
  try {
    const resolutionResponse = await supabase
      .from("community_registration_duplicate_resolutions")
      .select(
        "unit_low_id,unit_high_id,resolution_type,canonical_unit_id,duplicate_unit_id",
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
  const hiddenPairs = new Set(
    resolutions
      .filter((row) => ["merged", "dismissed"].includes(clean(row.resolution_type)))
      .map((row) => pairKey(clean(row.unit_low_id), clean(row.unit_high_id))),
  );

  const residentsByUnit = new Map<string, RegistrationDuplicateResident[]>();
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
        clean(row.normalized_email).toLocaleLowerCase("es-HN") || null,
      normalizedFullName:
        normalizedText(row.normalized_full_name || row.full_name),
      normalizedPhone: clean(row.normalized_phone) || null,
      phone: clean(row.phone) || null,
      position: Number(row.position ?? 0),
      unitId,
    };

    const current = residentsByUnit.get(unitId) ?? [];
    current.push(resident);
    residentsByUnit.set(unitId, current);
  }

  const units: RegistrationDuplicateUnit[] = unitsResponse.data
    .map((rawUnit) => {
      const row = rawUnit as Record<string, unknown>;
      const id = clean(row.id);
      if (!id || mergedUnitIds.includes(id)) return null;

      return {
        id,
        label: clean(row.unit_label_snapshot),
        reference: clean(row.unit_reference_snapshot) || null,
        residents: (residentsByUnit.get(id) ?? []).sort(
          (left, right) => left.position - right.position,
        ),
        status: clean(row.status),
      } satisfies RegistrationDuplicateUnit;
    })
    .filter((unit): unit is RegistrationDuplicateUnit => unit !== null)
    .filter(
      (unit) =>
        unit.status !== "unregistered" &&
        unit.status !== "merged" &&
        unit.residents.length > 0,
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
    units,
  };
}
