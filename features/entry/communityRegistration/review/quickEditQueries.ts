import "server-only";

import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { coerceNumber, coerceString } from "@/lib/supabase/utils";

export type CommunityRegistrationQuickEditResident = {
  email: string | null;
  fullName: string;
  id: string;
  phone: string | null;
  position: number;
};

export type CommunityRegistrationQuickEditData = {
  residents: CommunityRegistrationQuickEditResident[];
  submissionId: string;
};

function nullableString(value: unknown) {
  const normalized = coerceString(value).trim();
  return normalized || null;
}

export async function getCommunityRegistrationQuickEditData(
  campaignUnitId: string,
): Promise<CommunityRegistrationQuickEditData | null> {
  await requireSuperadmin();
  const supabase = createAdminClient();

  const { data: unit, error: unitError } = await supabase
    .from("community_registration_units")
    .select("id,status")
    .eq("id", campaignUnitId)
    .maybeSingle();

  if (unitError || !unit || unit.status !== "submitted") return null;

  const { data: submission, error: submissionError } = await supabase
    .from("community_registration_submissions")
    .select("id,status,version_number")
    .eq("campaign_unit_id", campaignUnitId)
    .in("status", ["submitted", "edit_enabled", "reviewed", "confirmed", "converted"])
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (submissionError || !submission || submission.status !== "submitted") return null;

  const { data: residents, error: residentsError } = await supabase
    .from("community_registration_residents")
    .select("id,position,full_name,email,phone")
    .eq("submission_id", submission.id)
    .eq("campaign_unit_id", campaignUnitId)
    .order("position", { ascending: true });

  if (residentsError || !Array.isArray(residents)) return null;

  return {
    submissionId: coerceString(submission.id).trim(),
    residents: residents
      .map((resident) => ({
        id: coerceString(resident.id).trim(),
        position: coerceNumber(resident.position),
        fullName: coerceString(resident.full_name).trim(),
        email: nullableString(resident.email),
        phone: nullableString(resident.phone),
      }))
      .filter(
        (resident) =>
          Boolean(resident.id) && resident.position > 0 && Boolean(resident.fullName),
      ),
  };
}
