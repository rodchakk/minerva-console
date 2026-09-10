"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { getEntryPreviewReadOnlyError } from "@/features/entry/deploymentBoundary";
import { createClient } from "@/lib/supabase/server";

export type FieldCommunityStatusResult = {
  error?: string;
  result?: Record<string, unknown>;
  success: boolean;
};

function revalidateCommunityStatusPaths(communityId: string) {
  revalidatePath("/field/entry/communities");
  revalidatePath(`/field/entry/communities/${communityId}`);
  revalidatePath(`/field/entry/communities/${communityId}/people`);
  revalidatePath("/products/entry/communities");
  revalidatePath(`/products/entry/communities/${communityId}`);
  revalidatePath(`/products/entry/communities/${communityId}/users`);
  revalidatePath("/products/entry/users");
}

export async function setFieldCommunityActiveStatus(input: {
  communityId: string;
  isActive: boolean;
}): Promise<FieldCommunityStatusResult> {
  await requireSuperadmin();
  const previewReadOnlyError = getEntryPreviewReadOnlyError();

  if (previewReadOnlyError) {
    return { error: previewReadOnlyError, success: false };
  }

  const communityId = input.communityId.trim();
  if (!communityId) {
    return { error: "Community ID is required.", success: false };
  }

  // Reuse the canonical authenticated lifecycle RPC. It performs the cascade,
  // preserves historical records, restores only community-suspended members on
  // reactivation, and records both system and superadmin audit events.
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sa_set_community_active_status", {
    p_community_id: communityId,
    p_is_active: input.isActive,
  });

  if (error) {
    return { error: error.message, success: false };
  }

  revalidateCommunityStatusPaths(communityId);

  return {
    result:
      data && typeof data === "object" && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : undefined,
    success: true,
  };
}
