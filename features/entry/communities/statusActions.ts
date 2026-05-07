"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { createClient } from "@/lib/supabase/server";

export type SetCommunityActiveStatusResult = {
  error?: string;
  result?: Record<string, unknown>;
  success: boolean;
};

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

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sa_set_community_active_status", {
    p_community_id: communityId,
    p_is_active: isActive,
  });

  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/products/entry/communities");
  revalidatePath(`/products/entry/communities/${communityId}`);

  return {
    success: true,
    result: data && typeof data === "object" ? (data as Record<string, unknown>) : {},
  };
}
