"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { getEntryPreviewReadOnlyError } from "@/features/entry/deploymentBoundary";
import { getCommunityRegistrationDuplicateReviewData } from "@/features/entry/communityRegistration/review/duplicateQueries";
import { createAdminClient } from "@/lib/supabase/admin";

export type RegistrationBulkActionResult =
  | {
      success: true;
      message: string;
      changedCount: number;
      blockedCount?: number;
    }
  | {
      success: false;
      error: string;
    };

function normalizeIds(unitIds: string[]) {
  return Array.from(
    new Set(unitIds.map((value) => value.trim()).filter(Boolean)),
  ).slice(0, 100);
}

async function findDuplicateBlockedUnitIds(input: {
  communityId: string;
  unitIds: string[];
}) {
  const supabase = createAdminClient();
  const { data: rows, error } = await supabase
    .from("community_registration_units")
    .select("id,campaign_id")
    .eq("community_id", input.communityId)
    .in("id", input.unitIds);

  if (error || !Array.isArray(rows) || rows.length !== input.unitIds.length) {
    return {
      error:
        "One or more selected units changed. Refresh before continuing.",
      blockedIds: [] as string[],
    };
  }

  const campaignIds = Array.from(
    new Set(
      rows
        .map((row) => String((row as Record<string, unknown>).campaign_id ?? "").trim())
        .filter(Boolean),
    ),
  );

  if (campaignIds.length !== 1) {
    return {
      error:
        "Selected units must belong to the same active registration campaign.",
      blockedIds: [] as string[],
    };
  }

  const duplicateData = await getCommunityRegistrationDuplicateReviewData(
    campaignIds[0],
    input.communityId,
  );
  const duplicateIds = new Set(duplicateData.duplicateUnitIds);

  return {
    error: null,
    blockedIds: input.unitIds.filter((unitId) => duplicateIds.has(unitId)),
  };
}

function revalidate(communityId: string) {
  revalidatePath(`/products/entry/communities/${communityId}`);
  revalidatePath(`/products/entry/communities/${communityId}/registration`);
  revalidatePath("/products/entry/activation");
}

export async function markRegistrationUnitsReadyForPatronato(input: {
  communityId: string;
  unitIds: string[];
}): Promise<RegistrationBulkActionResult> {
  const auth = await requireSuperadmin();
  const previewError = getEntryPreviewReadOnlyError();

  if (previewError) return { success: false, error: previewError };

  const communityId = input.communityId.trim();
  const unitIds = normalizeIds(input.unitIds);

  if (!communityId || unitIds.length === 0) {
    return { success: false, error: "Select submitted units first." };
  }

  const duplicateCheck = await findDuplicateBlockedUnitIds({
    communityId,
    unitIds,
  });
  if (duplicateCheck.error) {
    return { success: false, error: duplicateCheck.error };
  }
  if (duplicateCheck.blockedIds.length > 0) {
    return {
      success: false,
      error:
        "Resolve possible duplicates before sending the selected households to Patronato.",
    };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc(
    "mark_community_registration_units_reviewed_v2",
    {
      p_actor_user_id: auth.user.id,
      p_campaign_unit_ids: unitIds,
      p_community_id: communityId,
    },
  );

  if (error) {
    return {
      success: false,
      error:
        "One or more units changed before the batch was committed. Refresh and review the current state.",
    };
  }

  const record =
    data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const changedCount = Number(record.reviewed_count ?? 0);

  revalidate(communityId);

  return {
    success: true,
    changedCount,
    message: `${changedCount} ${changedCount === 1 ? "unit is" : "units are"} ready for Patronato.`,
  };
}

export async function prepareApprovedRegistrationUnitsForActivation(input: {
  communityId: string;
  unitIds: string[];
}): Promise<RegistrationBulkActionResult> {
  const auth = await requireSuperadmin();
  const previewError = getEntryPreviewReadOnlyError();

  if (previewError) return { success: false, error: previewError };

  const communityId = input.communityId.trim();
  const unitIds = normalizeIds(input.unitIds);

  if (!communityId || unitIds.length === 0) {
    return { success: false, error: "Select Patronato-approved units first." };
  }

  const duplicateCheck = await findDuplicateBlockedUnitIds({
    communityId,
    unitIds,
  });
  if (duplicateCheck.error) {
    return { success: false, error: duplicateCheck.error };
  }
  if (duplicateCheck.blockedIds.length > 0) {
    return {
      success: false,
      error:
        "Resolve possible duplicates before moving the selected households to Activation Queue.",
    };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc(
    "convert_community_registration_units_to_activation_v2",
    {
      p_actor_user_id: auth.user.id,
      p_campaign_unit_ids: unitIds,
      p_community_id: communityId,
      p_reason: "Patronato approved · batch handoff from Resident Registration",
    },
  );

  if (error) {
    return {
      success: false,
      error:
        "The Activation Queue batch was rolled back because one or more units changed. Refresh before retrying.",
    };
  }

  const record =
    data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const changedCount = Number(record.processed_count ?? 0);
  const blockedCount = Number(record.blocked_count ?? 0);

  revalidate(communityId);

  return {
    success: true,
    changedCount,
    blockedCount,
    message:
      blockedCount > 0
        ? `${changedCount} moved to Activation Queue · ${blockedCount} need manual review.`
        : `${changedCount} ${changedCount === 1 ? "unit moved" : "units moved"} to Activation Queue.`,
  };
}
