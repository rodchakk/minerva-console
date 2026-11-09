"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { getEntryPreviewReadOnlyError } from "@/features/entry/deploymentBoundary";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type UnitRelationshipAction = "link_units" | "unlink_units" | "assign_responsible" | "remove_responsible" | "rename_unit";

const RELATIONSHIP_OPTION_LIMIT = 100;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type AdminClient = ReturnType<typeof createAdminClient>;

function unitLabel(house: { id: unknown; house_label: unknown; public_reference?: unknown; unit_reference?: unknown }) {
  const id = String(house.id);
  return `${String(house.house_label)} · ${String(house.public_reference ?? house.unit_reference ?? id.slice(0, 8))}`;
}

async function queryUnitOptions(db: AdminClient, communityId: string, search: string) {
  const term = search.trim();
  if (UUID_PATTERN.test(term)) {
    const { data, error } = await db
      .from("houses")
      .select("id,house_label,public_reference,unit_reference")
      .eq("community_id", communityId)
      .eq("id", term)
      .maybeSingle();
    return { error: error?.message ?? null, options: data ? [{ id: String(data.id), label: unitLabel(data) }] : [] };
  }

  let query = db
    .from("houses")
    .select("id,house_label,public_reference,unit_reference")
    .eq("community_id", communityId)
    .order("house_label")
    .limit(RELATIONSHIP_OPTION_LIMIT);
  if (term) query = query.ilike("house_label", `%${term.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`);
  const { data, error } = await query;
  return {
    error: error?.message ?? null,
    options: (data ?? []).map((house) => ({ id: String(house.id), label: unitLabel(house) })),
  };
}

async function queryCommunityMemberOptions(db: AdminClient, communityId: string, search: string, offset = 0) {
  const term = search.trim();
  let memberships: Array<{ user_id: unknown; role: unknown; is_active: unknown }> = [];
  let profileRows: Array<{ user_id: unknown; full_name: unknown }> = [];
  let hasMore = false;

  if (UUID_PATTERN.test(term)) {
    const { data: membership, error: membershipError } = await db
      .from("community_members")
      .select("user_id,role,is_active")
      .eq("community_id", communityId)
      .eq("user_id", term)
      .maybeSingle();
    if (membershipError) return { error: membershipError.message, hasMore: false, options: [] };
    memberships = membership ? [membership] : [];
    if (membership) {
      const { data: profile, error: profileError } = await db.from("profiles").select("user_id,full_name").eq("user_id", term).maybeSingle();
      if (profileError) return { error: profileError.message, hasMore: false, options: [] };
      profileRows = profile ? [profile] : [];
    }
  } else if (term) {
    return { error: "Enter a complete account UUID to search directly.", hasMore: false, options: [] };
  } else {
    const { data, error } = await db
      .from("community_members")
      .select("user_id,role,is_active")
      .eq("community_id", communityId)
      .order("user_id")
      .range(offset, offset + RELATIONSHIP_OPTION_LIMIT);
    if (error) return { error: error.message, hasMore: false, options: [] };
    hasMore = (data?.length ?? 0) > RELATIONSHIP_OPTION_LIMIT;
    memberships = (data ?? []).slice(0, RELATIONSHIP_OPTION_LIMIT);
    const userIds = memberships.map((membership) => String(membership.user_id));
    if (userIds.length) {
      const { data: profiles, error: profileError } = await db
        .from("profiles")
        .select("user_id,full_name")
        .in("user_id", userIds);
      if (profileError) return { error: profileError.message, hasMore: false, options: [] };
      profileRows = profiles ?? [];
    }
  }

  const profiles = new Map(profileRows.map((profile) => [String(profile.user_id), profile]));
  return {
    error: null,
    hasMore,
    options: memberships.map((membership) => {
      const id = String(membership.user_id);
      const profile = profiles.get(id);
      const name = profile?.full_name ? String(profile.full_name) : `Account ${id.slice(0, 8)} · profile unavailable`;
      return { id, label: `${name} · ${String(membership.role)}${membership.is_active === true ? "" : " · inactive"}` };
    }),
  };
}

export async function searchRelationshipUnits(communityId: string, search = "") {
  await requireSuperadmin();
  return queryUnitOptions(createAdminClient(), communityId, search);
}

export async function searchCommunityMemberOptions(communityId: string, search = "", offset = 0) {
  await requireSuperadmin();
  return queryCommunityMemberOptions(createAdminClient(), communityId, search, Math.max(0, Math.trunc(offset)));
}

export async function getUserResponsibleUnits(communityId: string, userId: string) {
  await requireSuperadmin();
  const db = createAdminClient();
  const [{ data: setting, error: settingError }, { data: rows, error }, unitOptions] = await Promise.all([
    db.from("community_settings").select("allow_unit_relationships").eq("community_id", communityId).maybeSingle(),
    db.from("entry_unit_responsibilities").select("id,house_id,ended_at").eq("community_id", communityId).eq("user_id", userId).is("ended_at", null),
    queryUnitOptions(db, communityId, ""),
  ]);
  if (settingError) return { enabled: true, error: "Unit relationships are unavailable. The database migration must be installed first.", items: [], units: [] };
  if (setting?.allow_unit_relationships !== true) return { enabled: false, error: null, items: [], units: [] };
  if (error) return { enabled: true, error: error.message, items: [], units: [] };
  const houseIds = [...new Set((rows ?? []).map((row) => String(row.house_id)))];
  const [{ data: membership, error: membershipError }, houseResult] = await Promise.all([
    db.from("community_members").select("user_id").eq("community_id", communityId).eq("user_id", userId).maybeSingle(),
    houseIds.length
      ? db.from("houses").select("id,house_label,public_reference,unit_reference").eq("community_id", communityId).in("id", houseIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const byId = new Map((houseResult.data ?? []).map((house) => [String(house.id), house]));
  const items = (rows ?? []).map((row) => {
    const houseId = String(row.house_id);
    const house = byId.get(houseId);
    return house
      ? { id: String(row.id), houseId, label: unitLabel(house), warning: null }
      : { id: String(row.id), houseId, label: `Unit ${houseId}`, warning: "Unit details are unavailable. The stored responsibility is still active." };
  });
  const errors = [
    unitOptions.error,
    membershipError?.message,
    membership ? null : "This account is not a member of the community.",
    houseResult.error?.message,
  ].filter(Boolean);
  return { enabled: true, error: errors.length ? errors.join(" ") : null, items, units: unitOptions.options };
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
  revalidatePath(`/field/entry/communities/${input.communityId}/people`);
  revalidatePath(`/field/entry/communities/${input.communityId}/people/units/${input.unitId}`);
  revalidatePath('/products/entry/users');
  return { data, success: true as const };
}
