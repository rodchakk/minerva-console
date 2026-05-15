"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { createAdminClient } from "@/lib/supabase/admin";

export type SetCommunityActiveStatusResult = {
  error?: string;
  result?: Record<string, unknown>;
  success: boolean;
};

function getFrequentVisitorDeactivationMarker(communityId: string) {
  return `__MINERVA_COMMUNITY_DEACTIVATED__:${communityId}`;
}

function appendFrequentVisitorDeactivationMarker(
  notes: string | null,
  communityId: string,
) {
  const marker = getFrequentVisitorDeactivationMarker(communityId);
  const normalizedNotes = notes?.trim() ?? "";

  if (normalizedNotes.includes(marker)) {
    return normalizedNotes;
  }

  return normalizedNotes ? `${normalizedNotes}\n${marker}` : marker;
}

function removeFrequentVisitorDeactivationMarker(
  notes: string | null,
  communityId: string,
) {
  const marker = getFrequentVisitorDeactivationMarker(communityId);
  const normalizedNotes = notes?.trim() ?? "";

  if (!normalizedNotes) {
    return null;
  }

  const cleaned = normalizedNotes
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && line !== marker)
    .join("\n")
    .trim();

  return cleaned || null;
}

async function deactivateCommunityDirectly(
  communityId: string,
): Promise<SetCommunityActiveStatusResult> {
  const adminSupabase = createAdminClient();
  const revokedAt = new Date().toISOString();

  const { data: activeVisitors, error: activeVisitorsError } = await adminSupabase
    .from("authorized_frequent_visitors")
    .select("id,notes")
    .eq("community_id", communityId)
    .eq("is_active", true);

  if (activeVisitorsError) {
    return {
      success: false,
      error: activeVisitorsError.message,
    };
  }

  const visitorUpdates = Array.isArray(activeVisitors)
    ? activeVisitors.map((visitor) =>
        adminSupabase
          .from("authorized_frequent_visitors")
          .update({
            is_active: false,
            notes: appendFrequentVisitorDeactivationMarker(
              typeof visitor.notes === "string" ? visitor.notes : null,
              communityId,
            ),
            revoked_at: revokedAt,
            revoked_by: null,
            updated_at: revokedAt,
          })
          .eq("id", visitor.id),
      )
    : [];

  if (visitorUpdates.length > 0) {
    const visitorResults = await Promise.all(visitorUpdates);
    const visitorUpdateError = visitorResults.find((result) => result.error)?.error;

    if (visitorUpdateError) {
      return {
        success: false,
        error: visitorUpdateError.message,
      };
    }
  }

  const { error: profilesError } = await adminSupabase
    .from("profiles")
    .update({
      deactivated_by_community: true,
      is_active: false,
    })
    .eq("community_id", communityId)
    .eq("is_active", true);

  if (profilesError) {
    return {
      success: false,
      error: profilesError.message,
    };
  }

  const { error: membershipsError } = await adminSupabase
    .from("community_members")
    .update({
      deactivated_by_community: true,
      is_active: false,
    })
    .eq("community_id", communityId)
    .eq("is_active", true);

  if (membershipsError) {
    return {
      success: false,
      error: membershipsError.message,
    };
  }

  const { error: communityError } = await adminSupabase
    .from("communities")
    .update({ is_active: false })
    .eq("id", communityId);

  if (communityError) {
    return {
      success: false,
      error: communityError.message,
    };
  }

  revalidateCommunityPaths(communityId);

  return {
    success: true,
    result: {
      fallbackApplied: true,
      method: "direct_admin_deactivation",
      visitorsMarked: visitorUpdates.length,
    },
  };
}

async function reactivateCommunityDirectly(
  communityId: string,
): Promise<SetCommunityActiveStatusResult> {
  const adminSupabase = createAdminClient();
  const marker = getFrequentVisitorDeactivationMarker(communityId);

  const { error: profilesError } = await adminSupabase
    .from("profiles")
    .update({
      deactivated_by_community: false,
      is_active: true,
    })
    .eq("community_id", communityId)
    .eq("deactivated_by_community", true);

  if (profilesError) {
    return {
      success: false,
      error: profilesError.message,
    };
  }

  const { error: membershipsError } = await adminSupabase
    .from("community_members")
    .update({
      deactivated_by_community: false,
      is_active: true,
    })
    .eq("community_id", communityId)
    .eq("deactivated_by_community", true);

  if (membershipsError) {
    return {
      success: false,
      error: membershipsError.message,
    };
  }

  const { data: markedVisitors, error: markedVisitorsError } = await adminSupabase
    .from("authorized_frequent_visitors")
    .select("id,notes")
    .eq("community_id", communityId)
    .eq("is_active", false)
    .like("notes", `%${marker}%`);

  if (markedVisitorsError) {
    return {
      success: false,
      error: markedVisitorsError.message,
    };
  }

  const visitorUpdates = Array.isArray(markedVisitors)
    ? markedVisitors.map((visitor) =>
        adminSupabase
          .from("authorized_frequent_visitors")
          .update({
            is_active: true,
            notes: removeFrequentVisitorDeactivationMarker(
              typeof visitor.notes === "string" ? visitor.notes : null,
              communityId,
            ),
            revoked_at: null,
            revoked_by: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", visitor.id),
      )
    : [];

  if (visitorUpdates.length > 0) {
    const visitorResults = await Promise.all(visitorUpdates);
    const visitorUpdateError = visitorResults.find((result) => result.error)?.error;

    if (visitorUpdateError) {
      return {
        success: false,
        error: visitorUpdateError.message,
      };
    }
  }

  const { error: communityError } = await adminSupabase
    .from("communities")
    .update({ is_active: true })
    .eq("id", communityId);

  if (communityError) {
    return {
      success: false,
      error: communityError.message,
    };
  }

  revalidateCommunityPaths(communityId);

  return {
    success: true,
    result: {
      fallbackApplied: true,
      method: "direct_admin_reactivation",
      visitorsRestored: visitorUpdates.length,
    },
  };
}

function revalidateCommunityPaths(communityId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/products/entry/activation");
  revalidatePath("/products/entry/communities");
  revalidatePath(`/products/entry/communities/${communityId}`);
  revalidatePath(`/products/entry/communities/${communityId}/users`);
  revalidatePath("/products/entry/messages");
  revalidatePath("/products/entry/users");
}

export async function setCommunityActiveStatusAction(
  communityId: string,
  isActive: boolean,
): Promise<SetCommunityActiveStatusResult> {
  await requireSuperadmin();

  if (!communityId) {
    return {
      success: false,
      error: "Community ID is required.",
    };
  }

  if (!isActive) {
    return deactivateCommunityDirectly(communityId);
  }

  return reactivateCommunityDirectly(communityId);
}
