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
    // Reuse the existing, superadmin-only account search for names and emails.
    // Profiles may be attached to another community, so search both the
    // current profile community and global profiles, then independently scope
    // every candidate to an actual membership in the requested community.
    const userDb = await createClient();
    const searchTerm = term.slice(0, 120);
    const [scoped, global] = await Promise.all([
      userDb.rpc("sa_list_users", { p_community_id: communityId, p_search: searchTerm }),
      userDb.rpc("sa_list_users", { p_community_id: null, p_search: searchTerm }),
    ]);
    if (scoped.error || global.error) {
      return { error: "Could not search community members. Please try again.", hasMore: false, options: [] };
    }
    const matches = new Map<string, { user_id: unknown; full_name: unknown; email?: unknown }>();
    for (const item of [...(scoped.data ?? []), ...(global.data ?? [])]) {
      const candidate = item as { user_id?: unknown; full_name?: unknown; email?: unknown };
      if (candidate.user_id) matches.set(String(candidate.user_id), {
        user_id: candidate.user_id,
        full_name: candidate.full_name,
        email: candidate.email,
      });
    }
    const ids = [...matches.keys()];
    if (!ids.length) return { error: null, hasMore: false, options: [] };
    const { data, error } = await db
      .from("community_members")
      .select("user_id,role,is_active")
      .eq("community_id", communityId)
      .in("user_id", ids)
      .order("user_id")
      .limit(RELATIONSHIP_OPTION_LIMIT + 1);
    if (error) return { error: error.message, hasMore: false, options: [] };
    hasMore = (data?.length ?? 0) > RELATIONSHIP_OPTION_LIMIT;
    memberships = (data ?? []).slice(0, RELATIONSHIP_OPTION_LIMIT);
    profileRows = memberships
      .map((member) => matches.get(String(member.user_id)))
      .filter((profile): profile is { user_id: unknown; full_name: unknown; email?: unknown } => Boolean(profile));
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


export async function getUnitRelationshipsAction(communityId: string, unitId: string) {
  await requireSuperadmin();
  const db = createAdminClient();
  const [{ data: setting, error: settingError }, { data: linkRows, error: linksError }, { data: responsibilityRows, error: responsibilitiesError }, unitOptions, peopleOptions] = await Promise.all([
    db.from("community_settings").select("allow_unit_relationships").eq("community_id", communityId).maybeSingle(),
    db.from("entry_unit_links").select("id,unit_a_id,unit_b_id").eq("community_id", communityId).is("ended_at", null).or(`unit_a_id.eq.${unitId},unit_b_id.eq.${unitId}`),
    db.from("entry_unit_responsibilities").select("id,user_id").eq("community_id", communityId).eq("house_id", unitId).is("ended_at", null),
    searchRelationshipUnits(communityId),
    searchCommunityMemberOptions(communityId),
  ]);
  if (settingError || linksError || responsibilitiesError) return { enabled: false as const, error: "Unit relationships are unavailable. Check the database migration and try again." };
  // Keep the new management UI entirely hidden in communities where the
  // relationship feature is disabled (e.g. Andalucía).
  if (setting?.allow_unit_relationships !== true) return { enabled: false as const, error: null };

  const linkedUnitIds = [...new Set((linkRows ?? []).map((row) => String(row.unit_a_id) === unitId ? String(row.unit_b_id) : String(row.unit_a_id)))];
  const responsibleUserIds = [...new Set((responsibilityRows ?? []).map((row) => String(row.user_id)))];
  const [linkedUnitsResult, membershipsResult, profilesResult] = await Promise.all([
    linkedUnitIds.length
      ? db.from("houses").select("id,house_label,public_reference,unit_reference").eq("community_id", communityId).in("id", linkedUnitIds)
      : Promise.resolve({ data: [], error: null }),
    responsibleUserIds.length
      ? db.from("community_members").select("user_id,role,is_active").eq("community_id", communityId).in("user_id", responsibleUserIds)
      : Promise.resolve({ data: [], error: null }),
    responsibleUserIds.length
      ? db.from("profiles").select("user_id,full_name").in("user_id", responsibleUserIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const unitMap = new Map((linkedUnitsResult.data ?? []).map((unit) => [String(unit.id), unit]));
  const membershipMap = new Map((membershipsResult.data ?? []).map((membership) => [String(membership.user_id), membership]));
  const profileMap = new Map((profilesResult.data ?? []).map((profile) => [String(profile.user_id), profile]));
  const links = (linkRows ?? []).map((row) => {
    const linkedUnitId = String(row.unit_a_id) === unitId ? String(row.unit_b_id) : String(row.unit_a_id);
    const unit = unitMap.get(linkedUnitId);
    return unit
      ? { id: String(row.id), unitId: linkedUnitId, label: `${String(unit.house_label)} · ${String(unit.public_reference ?? unit.unit_reference ?? linkedUnitId.slice(0, 8))}`, warning: null }
      : { id: String(row.id), unitId: linkedUnitId, label: `Unit ${linkedUnitId}`, warning: "Unit details are unavailable. The stored relationship is still active." };
  });
  const responsibilities = (responsibilityRows ?? []).map((row) => {
    const userId = String(row.user_id);
    const membership = membershipMap.get(userId);
    const profile = profileMap.get(userId);
    const warning = !membership
      ? "Membership details are unavailable. The stored responsibility is still active."
      : !profile?.full_name
        ? "Profile details are unavailable. The stored responsibility is still active."
        : null;
    return {
      id: String(row.id),
      userId,
      label: profile?.full_name ? String(profile.full_name) : `Account ${userId}`,
      role: membership?.role ? String(membership.role) : "role unavailable",
      active: membership?.is_active === true,
      warning,
    };
  });
  const selectorError = [unitOptions.error, peopleOptions.error, linkedUnitsResult.error?.message, membershipsResult.error?.message, profilesResult.error?.message].filter(Boolean).join(" ");
  return { enabled: true as const, error: null, units: unitOptions.options, people: peopleOptions.options, peopleHasMore: peopleOptions.hasMore, links, responsibilities, selectorError: selectorError || null };
}
