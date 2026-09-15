import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

type CampaignIdRecord = {
  id?: string | null;
};

type UnitReferenceRecord = {
  unit_label_snapshot?: string | null;
  unit_reference_snapshot?: string | null;
};

export async function resolveCommunityRegistrationUnitReferences(input: {
  publicSlug: string;
}) {
  const publicSlug = input.publicSlug.trim().toLocaleLowerCase("es-GT");
  if (!publicSlug) return {} as Record<string, string>;

  try {
    const supabase = createAdminClient();
    const campaignResponse = await supabase
      .from("community_registration_campaigns")
      .select("id")
      .eq("public_slug", publicSlug)
      .maybeSingle();

    if (campaignResponse.error || !campaignResponse.data) {
      return {} as Record<string, string>;
    }

    const campaignId = (campaignResponse.data as CampaignIdRecord).id?.trim();
    if (!campaignId) return {} as Record<string, string>;

    const unitsResponse = await supabase
      .from("community_registration_units")
      .select("unit_label_snapshot,unit_reference_snapshot")
      .eq("campaign_id", campaignId)
      .eq("status", "unregistered");

    if (unitsResponse.error || !Array.isArray(unitsResponse.data)) {
      // References are optional presentation metadata. Registration must not
      // fail if the column is unavailable or the auxiliary read fails.
      return {} as Record<string, string>;
    }

    const references: Record<string, string> = {};

    for (const row of unitsResponse.data as UnitReferenceRecord[]) {
      const unitLabel = row.unit_label_snapshot?.trim();
      const reference = row.unit_reference_snapshot?.trim();
      if (!unitLabel || !reference) continue;
      references[unitLabel] = reference;
    }

    return references;
  } catch {
    return {} as Record<string, string>;
  }
}
