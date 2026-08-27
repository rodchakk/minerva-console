import "server-only";

import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { coerceString } from "@/lib/supabase/utils";
import {
  createReadyRegistrationProgressState,
  createUnavailableRegistrationProgressState,
  type FieldRegistrationProgressCampaign,
  type FieldRegistrationProgressState,
  type FieldRegistrationProgressUnit,
} from "@/features/entry/field/registrationProgressStatus";

const OPERATIONAL_CAMPAIGN_STATUSES = [
  "open",
  "paused",
  "review",
  "confirmed",
] as const;

function normalizeProgressCampaign(
  value: unknown,
): FieldRegistrationProgressCampaign | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = coerceString(record.id);

  if (!id) {
    return null;
  }

  return {
    id,
    publicTitle:
      coerceString(record.public_title).trim() || "Registro de residentes",
    status: coerceString(record.status, "open"),
  };
}

function normalizeProgressUnit(value: unknown): FieldRegistrationProgressUnit | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = coerceString(record.id);
  const label = coerceString(record.unit_label_snapshot).trim();

  if (!id || !label) {
    return null;
  }

  return {
    id,
    label,
    status: coerceString(record.status, "unregistered"),
  };
}

export async function getFieldRegistrationProgressState(
  communityId: string,
): Promise<FieldRegistrationProgressState> {
  await requireSuperadmin();

  const supabase = createAdminClient();
  const { data: campaignsData, error: campaignsError } = await supabase
    .from("community_registration_campaigns")
    .select("id,public_title,status,created_at")
    .eq("community_id", communityId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (campaignsError) {
    return createUnavailableRegistrationProgressState();
  }

  const campaigns = Array.isArray(campaignsData)
    ? campaignsData
        .map(normalizeProgressCampaign)
        .filter((item): item is FieldRegistrationProgressCampaign => item !== null)
    : [];
  const operationalCampaign =
    campaigns.find((item) =>
      OPERATIONAL_CAMPAIGN_STATUSES.includes(
        item.status as (typeof OPERATIONAL_CAMPAIGN_STATUSES)[number],
      ),
    ) ?? null;
  const campaign = operationalCampaign ?? campaigns[0] ?? null;

  if (!campaign) {
    return createReadyRegistrationProgressState(null, []);
  }

  const { data: campaignUnitsData, error: campaignUnitsError } = await supabase
    .from("community_registration_units")
    .select("id,unit_label_snapshot,status")
    .eq("campaign_id", campaign.id)
    .order("unit_label_snapshot", { ascending: true })
    .order("id", { ascending: true });

  if (campaignUnitsError) {
    return createUnavailableRegistrationProgressState();
  }

  return createReadyRegistrationProgressState(
    campaign,
    Array.isArray(campaignUnitsData)
      ? campaignUnitsData
          .map(normalizeProgressUnit)
          .filter((item): item is FieldRegistrationProgressUnit => item !== null)
      : [],
  );
}
