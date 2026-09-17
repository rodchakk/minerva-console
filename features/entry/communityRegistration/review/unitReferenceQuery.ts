import "server-only";

import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getCommunityRegistrationUnitReference(
  campaignUnitId: string,
): Promise<string | null> {
  await requireSuperadmin();
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("community_registration_units")
    .select("unit_reference_snapshot")
    .eq("id", campaignUnitId)
    .maybeSingle();

  if (error || !data) return null;

  const value =
    typeof data.unit_reference_snapshot === "string"
      ? data.unit_reference_snapshot.trim()
      : "";

  return value || null;
}
