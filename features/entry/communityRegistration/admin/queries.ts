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
  defaultResidentLimit: number;
  id: string;
  publicSlug: string;
  publicTitle: string;
  status: string;
};

export type CommunityRegistrationAdminState = {
  campaign: CommunityRegistrationAdminCampaign | null;
  hasOperationalCampaign: boolean;
  submittedStatuses: readonly string[];
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
      submittedStatuses: SUBMITTED_COMMUNITY_REGISTRATION_UNIT_STATUSES,
      submittedUnitCount: 0,
      totalCampaignUnitCount: 0,
      units,
    };
  }

  const { data: campaignUnitsData } = await supabase
    .from("community_registration_units")
    .select("status")
    .eq("campaign_id", campaign.id);
  const campaignUnits = Array.isArray(campaignUnitsData) ? campaignUnitsData : [];
  const submittedStatuses = new Set<string>(
    SUBMITTED_COMMUNITY_REGISTRATION_UNIT_STATUSES,
  );

  return {
    campaign,
    hasOperationalCampaign: operationalCampaign !== null,
    submittedStatuses: SUBMITTED_COMMUNITY_REGISTRATION_UNIT_STATUSES,
    submittedUnitCount: campaignUnits.filter((unit) =>
      submittedStatuses.has(coerceString((unit as Record<string, unknown>).status)),
    ).length,
    totalCampaignUnitCount: campaignUnits.length,
    units,
  };
}
