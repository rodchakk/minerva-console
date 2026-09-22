import "server-only";

import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { coerceString } from "@/lib/supabase/utils";

export type CommunityRegistrationContactEvent = {
  contactedAt: string;
  contactedByEmail: string | null;
  id: string;
  issueSignature: string;
  recipientName: string;
  recipientPhone: string;
  unitId: string;
};

function nullableString(value: unknown) {
  const normalized = coerceString(value).trim();
  return normalized || null;
}

function normalizeEvent(value: unknown): CommunityRegistrationContactEvent | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = coerceString(row.id).trim();
  const unitId = coerceString(row.campaign_unit_id).trim();
  const contactedAt = coerceString(row.contacted_at).trim();
  const issueSignature = coerceString(row.issue_signature).trim();
  const recipientName = coerceString(row.recipient_name_snapshot).trim();
  const recipientPhone = coerceString(row.recipient_phone_snapshot).trim();

  if (
    !id ||
    !unitId ||
    !contactedAt ||
    !issueSignature ||
    !recipientName ||
    !recipientPhone
  ) {
    return null;
  }

  return {
    contactedAt,
    contactedByEmail: nullableString(row.contacted_by_email_snapshot),
    id,
    issueSignature,
    recipientName,
    recipientPhone,
    unitId,
  };
}

export async function getCommunityRegistrationLatestContactStatuses(
  campaignId: string,
  communityId: string,
): Promise<CommunityRegistrationContactEvent[]> {
  await requireSuperadmin();

  if (!campaignId.trim() || !communityId.trim()) return [];

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("community_registration_contact_events")
    .select(
      "id,campaign_unit_id,issue_signature,recipient_name_snapshot,recipient_phone_snapshot,contacted_by_email_snapshot,contacted_at",
    )
    .eq("campaign_id", campaignId)
    .eq("community_id", communityId)
    .order("contacted_at", { ascending: false })
    .limit(500);

  if (error || !Array.isArray(data)) return [];

  const latestByUnit = new Map<string, CommunityRegistrationContactEvent>();
  for (const raw of data) {
    const event = normalizeEvent(raw);
    if (!event || latestByUnit.has(event.unitId)) continue;
    latestByUnit.set(event.unitId, event);
  }

  return Array.from(latestByUnit.values());
}

export async function getCommunityRegistrationContactHistory(
  campaignUnitId: string,
): Promise<CommunityRegistrationContactEvent[]> {
  await requireSuperadmin();

  if (!campaignUnitId.trim()) return [];

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("community_registration_contact_events")
    .select(
      "id,campaign_unit_id,issue_signature,recipient_name_snapshot,recipient_phone_snapshot,contacted_by_email_snapshot,contacted_at",
    )
    .eq("campaign_unit_id", campaignUnitId)
    .order("contacted_at", { ascending: false })
    .limit(20);

  if (error || !Array.isArray(data)) return [];

  return data
    .map(normalizeEvent)
    .filter(
      (event): event is CommunityRegistrationContactEvent => event !== null,
    );
}
