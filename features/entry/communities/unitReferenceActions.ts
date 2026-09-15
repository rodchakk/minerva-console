"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { getEntryPreviewReadOnlyError } from "@/features/entry/deploymentBoundary";
import { createAdminClient } from "@/lib/supabase/admin";
import { coerceString } from "@/lib/supabase/utils";

type UnitReferenceResult = {
  error?: string;
  publicReference?: string | null;
  success: boolean;
};

function revalidateUnitPaths(communityId: string, unitId: string) {
  revalidatePath(`/products/entry/communities/${communityId}`);
  revalidatePath(`/products/entry/communities/${communityId}/units`);
  revalidatePath(`/products/entry/communities/${communityId}/units/${unitId}`);
  revalidatePath(`/field/entry/communities/${communityId}`);
  revalidatePath(`/field/entry/communities/${communityId}/people`);
  revalidatePath(`/field/entry/communities/${communityId}/people/units/${unitId}`);
}

export async function getCommunityUnitPublicReferenceAction(input: {
  communityId: string;
  unitId: string;
}): Promise<UnitReferenceResult> {
  await requireSuperadmin();

  const communityId = input.communityId.trim();
  const unitId = input.unitId.trim();

  if (!communityId || !unitId) {
    return {
      error: "Community ID and unit ID are required.",
      success: false,
    };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("houses")
    .select("id,public_reference")
    .eq("community_id", communityId)
    .eq("id", unitId)
    .maybeSingle();

  if (error) {
    return { error: error.message, success: false };
  }

  if (!data) {
    return { error: "Unit not found in this community.", success: false };
  }

  const record = data as Record<string, unknown>;

  return {
    publicReference: coerceString(record.public_reference) || null,
    success: true,
  };
}

export async function updateCommunityUnitPublicReferenceAction(input: {
  communityId: string;
  publicReference?: string | null;
  unitId: string;
}): Promise<UnitReferenceResult> {
  await requireSuperadmin();
  const previewReadOnlyError = getEntryPreviewReadOnlyError();

  if (previewReadOnlyError) {
    return { error: previewReadOnlyError, success: false };
  }

  const communityId = input.communityId.trim();
  const unitId = input.unitId.trim();
  const publicReference = input.publicReference?.trim() || null;

  if (!communityId || !unitId) {
    return {
      error: "Community ID and unit ID are required.",
      success: false,
    };
  }

  if (publicReference && publicReference.length > 160) {
    return {
      error: "Resident-facing reference must be 160 characters or fewer.",
      success: false,
    };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("houses")
    .update({ public_reference: publicReference })
    .eq("community_id", communityId)
    .eq("id", unitId)
    .select("id,public_reference")
    .maybeSingle();

  if (error) {
    return { error: error.message, success: false };
  }

  if (!data) {
    return { error: "Unit not found in this community.", success: false };
  }

  revalidateUnitPaths(communityId, unitId);

  const record = data as Record<string, unknown>;

  return {
    publicReference: coerceString(record.public_reference) || null,
    success: true,
  };
}
