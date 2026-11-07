"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { getEntryPreviewReadOnlyError } from "@/features/entry/deploymentBoundary";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type UnitRelationshipAction = "link_units" | "unlink_units" | "assign_responsible" | "remove_responsible" | "rename_unit";

export async function getUserResponsibleUnits(communityId: string, userId: string) {
  await requireSuperadmin();
  const db = createAdminClient();
  const [{ data: setting }, { data: rows, error }] = await Promise.all([
    db.from("community_settings").select("allow_unit_relationships").eq("community_id", communityId).maybeSingle(),
    db.from("entry_unit_responsibilities").select("id,house_id,ended_at").eq("community_id", communityId).eq("user_id", userId).is("ended_at", null),
  ]);
  if (setting?.allow_unit_relationships !== true) return { enabled: false, error: null, items: [], units: [] };
  if (error) return { enabled: true, error: error.message, items: [], units: [] };
  const { data: membership } = await db.from("community_members").select("user_id").eq("community_id", communityId).eq("user_id", userId).maybeSingle();
  if (!membership) return { enabled: true, error: "This account is not a member of the community.", items: [], units: [] };
  const { data: houses, error: housesError } = await db.from("houses").select("id,house_label,public_reference,unit_reference").eq("community_id", communityId).order("house_label").limit(3000);
  if (housesError) return { enabled: true, error: housesError.message, items: [], units: [] };
  const byId = new Map((houses ?? []).map((house) => [String(house.id), house]));
  const items = (rows ?? []).flatMap((row) => {
    const houseId = String(row.house_id); const house = byId.get(houseId);
    return house ? [{ id: String(row.id), houseId, label: `${house.house_label} · ${house.public_reference ?? house.unit_reference ?? houseId.slice(0, 8)}` }] : [];
  });
  return { enabled: true, error: null, items, units: (houses ?? []).map((house) => ({ id: String(house.id), label: `${house.house_label} · ${house.public_reference ?? house.unit_reference ?? String(house.id).slice(0, 8)}` })) };
}

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
