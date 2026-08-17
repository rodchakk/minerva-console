import "server-only";

import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { coerceNumber, coerceString } from "@/lib/supabase/utils";

const REVIEW_CAMPAIGN_STATUSES = ["open", "paused", "review", "confirmed"] as const;

export type CommunityRegistrationReviewCampaign = {
  id: string;
  publicSlug: string;
  publicTitle: string;
  status: string;
};

export type CommunityRegistrationReviewSummary = {
  campaignStatus: string;
  confirmed: number;
  currentResidentCount: number;
  editEnabled: number;
  needsCorrection: number;
  pendingObservations: number;
  processed: number;
  reviewed: number;
  submitted: number;
  totalUnits: number;
  unregistered: number;
};

export type CommunityRegistrationReviewUnit = {
  hasPendingObservation: boolean;
  id: string;
  label: string;
  patronatoConfirmedAt: string | null;
  residentCount: number;
  reviewedAt: string | null;
  status: string;
  submittedAt: string | null;
};

export type CommunityRegistrationReviewResident = {
  email: string | null;
  fullName: string;
  isOwnerReference: boolean;
  phone: string | null;
  position: number;
  relationshipToHouse: string;
};

export type CommunityRegistrationCurrentReview = {
  createdAt: string | null;
  decision: string;
  observation: string | null;
  resolutionStatus: string;
};

export type CommunityRegistrationReviewUnitDetail = {
  effectiveResidentLimit: number;
  patronatoConfirmedAt: string | null;
  residents: CommunityRegistrationReviewResident[];
  review: CommunityRegistrationCurrentReview | null;
  reviewedAt: string | null;
  status: string;
  submittedAt: string | null;
  unitLabel: string;
  version: number;
};

export type CommunityRegistrationReviewOverview = {
  campaign: CommunityRegistrationReviewCampaign;
  loadError: string | null;
  summary: CommunityRegistrationReviewSummary;
  units: CommunityRegistrationReviewUnit[];
};

function nullableString(value: unknown) {
  const normalized = coerceString(value).trim();
  return normalized || null;
}

function emptySummary(status: string): CommunityRegistrationReviewSummary {
  return {
    campaignStatus: status,
    confirmed: 0,
    currentResidentCount: 0,
    editEnabled: 0,
    needsCorrection: 0,
    pendingObservations: 0,
    processed: 0,
    reviewed: 0,
    submitted: 0,
    totalUnits: 0,
    unregistered: 0,
  };
}

function normalizeCampaign(value: unknown): CommunityRegistrationReviewCampaign | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = coerceString(record.id).trim();
  const publicSlug = coerceString(record.public_slug).trim();
  if (!id || !publicSlug) return null;

  return {
    id,
    publicSlug,
    publicTitle:
      coerceString(record.public_title).trim() || "Registro de residentes",
    status: coerceString(record.status).trim() || "open",
  };
}

function normalizeSummary(
  value: unknown,
  fallbackStatus: string,
): CommunityRegistrationReviewSummary {
  if (!value || typeof value !== "object") return emptySummary(fallbackStatus);
  const record = value as Record<string, unknown>;

  return {
    campaignStatus: coerceString(record.campaign_status).trim() || fallbackStatus,
    confirmed: coerceNumber(record.confirmed),
    currentResidentCount: coerceNumber(record.current_resident_count),
    editEnabled: coerceNumber(record.edit_enabled),
    needsCorrection: coerceNumber(record.needs_correction),
    pendingObservations: coerceNumber(record.pending_observations),
    processed: coerceNumber(record.processed),
    reviewed: coerceNumber(record.reviewed),
    submitted: coerceNumber(record.submitted),
    totalUnits: coerceNumber(record.total_units),
    unregistered: coerceNumber(record.unregistered),
  };
}

function normalizeUnit(value: unknown): CommunityRegistrationReviewUnit | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = coerceString(record.unit_id).trim();
  const label = coerceString(record.unit_label).trim();
  if (!id || !label) return null;

  return {
    hasPendingObservation: record.has_pending_observation === true,
    id,
    label,
    patronatoConfirmedAt: nullableString(record.patronato_confirmed_at),
    residentCount: coerceNumber(record.resident_count),
    reviewedAt: nullableString(record.reviewed_at),
    status: coerceString(record.status).trim() || "unregistered",
    submittedAt: nullableString(record.submitted_at),
  };
}

function normalizeResident(
  value: unknown,
): CommunityRegistrationReviewResident | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const fullName = coerceString(record.full_name).trim();
  const position = coerceNumber(record.position);
  if (!fullName || position <= 0) return null;

  return {
    email: nullableString(record.email),
    fullName,
    isOwnerReference: record.is_owner_reference === true,
    phone: nullableString(record.phone),
    position,
    relationshipToHouse:
      coerceString(record.relationship_to_house).trim() || "unknown",
  };
}

function normalizeCurrentReview(value: unknown): CommunityRegistrationCurrentReview | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const decision = coerceString(record.decision).trim();
  if (!decision) return null;

  return {
    createdAt: nullableString(record.created_at),
    decision,
    observation: nullableString(record.observation),
    resolutionStatus: coerceString(record.resolution_status).trim() || "resolved",
  };
}

function normalizeUnitDetail(value: unknown): CommunityRegistrationReviewUnitDetail | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const unitLabel = coerceString(record.unit_label).trim();
  const residents = Array.isArray(record.residents)
    ? record.residents
        .map(normalizeResident)
        .filter(
          (resident): resident is CommunityRegistrationReviewResident =>
            resident !== null,
        )
        .sort((left, right) => left.position - right.position)
    : [];

  if (!unitLabel || residents.length === 0) return null;

  return {
    effectiveResidentLimit: coerceNumber(record.effective_resident_limit),
    patronatoConfirmedAt: nullableString(record.patronato_confirmed_at),
    residents,
    review: normalizeCurrentReview(record.review),
    reviewedAt: nullableString(record.reviewed_at),
    status: coerceString(record.status).trim() || "submitted",
    submittedAt: nullableString(record.submitted_at),
    unitLabel,
    version: coerceNumber(record.version),
  };
}

export async function getCommunityRegistrationReviewOverview(
  communityId: string,
): Promise<CommunityRegistrationReviewOverview | null> {
  await requireSuperadmin();
  const supabase = createAdminClient();

  const { data: campaignsData, error: campaignsError } = await supabase
    .from("community_registration_campaigns")
    .select("id,public_title,public_slug,status,created_at")
    .eq("community_id", communityId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (campaignsError) {
    throw new Error("Could not load Community Registration campaigns.");
  }

  const campaigns = Array.isArray(campaignsData)
    ? campaignsData
        .map(normalizeCampaign)
        .filter(
          (campaign): campaign is CommunityRegistrationReviewCampaign =>
            campaign !== null,
        )
    : [];
  const campaign =
    campaigns.find((item) =>
      REVIEW_CAMPAIGN_STATUSES.includes(
        item.status as (typeof REVIEW_CAMPAIGN_STATUSES)[number],
      ),
    ) ?? campaigns[0] ?? null;

  if (!campaign) return null;

  const [summaryResponse, unitsResponse] = await Promise.all([
    supabase.rpc("get_community_registration_review_summary_v1", {
      p_campaign_id: campaign.id,
      p_patronato_token_hash: null,
    }),
    supabase.rpc("list_community_registration_review_units_v1", {
      p_campaign_id: campaign.id,
      p_limit: 100,
      p_offset: 0,
      p_patronato_token_hash: null,
      p_status: null,
      p_unit_label_prefix: null,
    }),
  ]);

  const loadError =
    summaryResponse.error || unitsResponse.error
      ? "Review data could not be loaded completely. Refresh before taking action."
      : null;
  const unitsRecord =
    unitsResponse.data && typeof unitsResponse.data === "object"
      ? (unitsResponse.data as Record<string, unknown>)
      : null;
  const units = Array.isArray(unitsRecord?.units)
    ? unitsRecord.units
        .map(normalizeUnit)
        .filter((unit): unit is CommunityRegistrationReviewUnit => unit !== null)
    : [];

  return {
    campaign,
    loadError,
    summary: normalizeSummary(summaryResponse.data, campaign.status),
    units,
  };
}

export async function getCommunityRegistrationReviewUnit(
  campaignId: string,
  campaignUnitId: string,
): Promise<CommunityRegistrationReviewUnitDetail | null> {
  await requireSuperadmin();
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc(
    "get_community_registration_review_unit_v1",
    {
      p_campaign_id: campaignId,
      p_campaign_unit_id: campaignUnitId,
      p_patronato_token_hash: null,
    },
  );

  if (error) return null;
  return normalizeUnitDetail(data);
}
