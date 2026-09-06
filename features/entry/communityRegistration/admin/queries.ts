import "server-only";

import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  coerceNumber,
  coerceString,
} from "@/lib/supabase/utils";

export const SUBMITTED_COMMUNITY_REGISTRATION_UNIT_STATUSES = [
  "submitted",
  "edit_enabled",
  "needs_correction",
  "reviewed",
  "confirmed",
  "processed",
] as const;

const SUBMITTED_COMMUNITY_REGISTRATION_SUBMISSION_STATUSES = [
  "submitted",
  "edit_enabled",
  "reviewed",
  "confirmed",
  "converted",
] as const;

const OPERATIONAL_CAMPAIGN_STATUSES = [
  "open",
  "paused",
  "review",
  "confirmed",
] as const;

export type CommunityRegistrationAdminUnit = {
  id: string;
  label: string;
};

export type CommunityRegistrationAdminCampaign = {
  activeCampaignAccessRecoverable: boolean;
  defaultResidentLimit: number;
  id: string;
  publicSlug: string;
  publicTitle: string;
  status: string;
};

export type CommunityRegistrationAdminProgress = {
  percent: number;
  remainingResidents: number;
  submittedResidents: number;
  totalResidents: number;
};

export type CommunityRegistrationAdminState = {
  campaign: CommunityRegistrationAdminCampaign | null;
  hasOperationalCampaign: boolean;
  registrationProgress: CommunityRegistrationAdminProgress;
  submittedUnitCount: number;
  totalCampaignUnitCount: number;
  units: CommunityRegistrationAdminUnit[];
};

function normalizeCampaign(value: unknown): CommunityRegistrationAdminCampaign | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = coerceString(record.id);
  const publicSlug = coerceString(record.public_slug);

  if (!id || !publicSlug) {
    return null;
  }

  return {
    activeCampaignAccessRecoverable: false,
    defaultResidentLimit: coerceNumber(record.default_resident_limit) || 3,
    id,
    publicSlug,
    publicTitle:
      coerceString(record.public_title).trim() || "Registro de residentes",
    status: coerceString(record.status, "open"),
  };
}

function normalizeUnit(value: unknown): CommunityRegistrationAdminUnit | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = coerceString(record.id);
  const label =
    coerceString(record.house_label) ||
    coerceString(record.unit_label) ||
    coerceString(record.name);

  if (!id || !label.trim()) {
    return null;
  }

  return {
    id,
    label: label.trim(),
  };
}

function createRegistrationProgress(
  submittedResidents: number,
  totalResidents: number,
): CommunityRegistrationAdminProgress {
  const normalizedSubmitted = Math.max(0, Math.floor(submittedResidents));
  const normalizedTotal = Math.max(0, Math.floor(totalResidents));

  return {
    percent:
      normalizedTotal === 0
        ? 0
        : Math.min(
            100,
            Math.round((normalizedSubmitted / normalizedTotal) * 100),
          ),
    remainingResidents: Math.max(normalizedTotal - normalizedSubmitted, 0),
    submittedResidents: normalizedSubmitted,
    totalResidents: normalizedTotal,
  };
}

function getEffectiveResidentLimit(value: unknown, fallback: number) {
  const parsed = Math.floor(coerceNumber(value));
  return parsed > 0 ? parsed : fallback;
}

export async function getCommunityRegistrationAdminState(
  communityId: string,
): Promise<CommunityRegistrationAdminState> {
  await requireSuperadmin();

  const supabase = createAdminClient();
  const [
    { data: campaignsData },
    { data: housesData },
  ] = await Promise.all([
    supabase
      .from("community_registration_campaigns")
      .select("id,public_title,public_slug,status,default_resident_limit,created_at")
      .eq("community_id", communityId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("houses")
      .select("id,house_label")
      .eq("community_id", communityId)
      .order("house_label", { ascending: true }),
  ]);

  const campaigns = Array.isArray(campaignsData)
    ? campaignsData
        .map(normalizeCampaign)
        .filter(
          (item): item is CommunityRegistrationAdminCampaign => item !== null,
        )
    : [];
  const operationalCampaign =
    campaigns.find((item) =>
      OPERATIONAL_CAMPAIGN_STATUSES.includes(
        item.status as (typeof OPERATIONAL_CAMPAIGN_STATUSES)[number],
      ),
    ) ?? null;
  const campaign = operationalCampaign ?? campaigns[0] ?? null;
  const units = Array.isArray(housesData)
    ? housesData
        .map(normalizeUnit)
        .filter((item): item is CommunityRegistrationAdminUnit => item !== null)
    : [];

  if (!campaign) {
    return {
      campaign: null,
      hasOperationalCampaign: false,
      registrationProgress: createRegistrationProgress(0, 0),
      submittedUnitCount: 0,
      totalCampaignUnitCount: 0,
      units,
    };
  }

  const { data: campaignUnitsData } = await supabase
    .from("community_registration_units")
    .select("id,status,resident_limit_override")
    .eq("campaign_id", campaign.id);
  const [
    { data: activeAccessData },
    { data: recoverableAccessData },
    { data: currentSubmissionsData },
  ] = await Promise.all([
    supabase
      .from("community_registration_access_tokens")
      .select("id")
      .eq("campaign_id", campaign.id)
      .eq("token_type", "campaign_access")
      .eq("status", "active"),
    supabase
      .from("community_registration_access_tokens")
      .select("id")
      .eq("campaign_id", campaign.id)
      .eq("token_type", "campaign_access")
      .eq("status", "active")
      .not("encrypted_token_payload", "is", null),
    supabase
      .from("community_registration_submissions")
      .select("id")
      .eq("campaign_id", campaign.id)
      .in("status", SUBMITTED_COMMUNITY_REGISTRATION_SUBMISSION_STATUSES),
  ]);
  const campaignUnits = Array.isArray(campaignUnitsData) ? campaignUnitsData : [];
  const activeAccessRows = Array.isArray(activeAccessData) ? activeAccessData : [];
  const recoverableAccessRows = Array.isArray(recoverableAccessData)
    ? recoverableAccessData
    : [];
  const currentSubmissionIds = Array.isArray(currentSubmissionsData)
    ? currentSubmissionsData
        .map((submission) => coerceString((submission as Record<string, unknown>).id))
        .filter(Boolean)
    : [];
  const { count: submittedResidentCount } =
    currentSubmissionIds.length > 0
      ? await supabase
          .from("community_registration_residents")
          .select("id", { count: "exact", head: true })
          .in("submission_id", currentSubmissionIds)
      : { count: 0 };
  const activeCampaignAccessRecoverable =
    activeAccessRows.length === 1 && recoverableAccessRows.length === 1;
  const submittedStatuses = new Set<string>(
    SUBMITTED_COMMUNITY_REGISTRATION_UNIT_STATUSES,
  );
  const defaultResidentLimit = getEffectiveResidentLimit(
    campaign.defaultResidentLimit,
    3,
  );
  const totalResidents = campaignUnits.reduce((total, unit) => {
    const record = unit as Record<string, unknown>;
    return (
      total +
      getEffectiveResidentLimit(record.resident_limit_override, defaultResidentLimit)
    );
  }, 0);

  return {
    campaign: {
      ...campaign,
      activeCampaignAccessRecoverable,
    },
    hasOperationalCampaign: operationalCampaign !== null,
    registrationProgress: createRegistrationProgress(
      submittedResidentCount ?? 0,
      totalResidents,
    ),
    submittedUnitCount: campaignUnits.filter((unit) =>
      submittedStatuses.has(coerceString((unit as Record<string, unknown>).status)),
    ).length,
    totalCampaignUnitCount: campaignUnits.length,
    units,
  };
}
