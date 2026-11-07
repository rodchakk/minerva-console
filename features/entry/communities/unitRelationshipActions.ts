"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { getEntryPreviewReadOnlyError } from "@/features/entry/deploymentBoundary";
import { createClient } from "@/lib/supabase/server";

export type UnitRelationshipAction = "link_units" | "unlink_units" | "assign_responsible" | "remove_responsible" | "rename_unit";

export async function manageUnitRelationship(input: {
  action: UnitRelationshipAction;
  communityId: string;
  unitId: string;
  otherUnitId?: string;
  userId?: string;
  recordId?: string;
  label?: string;
  expectedLabel?: string;
}) {
  await requireSuperadmin();
  const boundary = getEntryPreviewReadOnlyError();
  if (boundary) return { error: boundary, success: false as const };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("manage_entry_unit_relationship_v1", {
    p_action: input.action,
    p_community_id: input.communityId,
    p_unit_id: input.unitId,
    p_other_unit_id: input.otherUnitId ?? null,
    p_user_id: input.userId ?? null,
    p_link_id: input.action === "unlink_units" ? input.recordId : null,
    p_responsibility_id: input.action === "remove_responsible" ? input.recordId : null,
    p_label: input.label ?? null,
    p_expected_label: input.expectedLabel ?? null,
  });
  if (error) return { error: error.message, success: false as const };
  revalidatePath(`/products/entry/communities/${input.communityId}/units/${input.unitId}`);
  revalidatePath(`/products/entry/communities/${input.communityId}/units`);
  revalidatePath(`/products/entry/communities/${input.communityId}/users`);
  return { data, success: true as const };
}
