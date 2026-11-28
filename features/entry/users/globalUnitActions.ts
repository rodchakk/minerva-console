"use server";

import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { coerceString, coerceBoolean } from "@/lib/supabase/utils";
import type { UserSearchItem } from "./actions";
import { getCommunityUnitDetailPageData } from "@/features/entry/communities/detailQueries";
import { getUnitRelationshipsAction } from "@/features/entry/communities/unitRelationshipActions";

export type GlobalUnitResult = {
  id: string; communityId: string; communityName: string; communityCity: string;
  label: string; isActive: boolean; unitReference: string; publicReference: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIMIT = 100;

export async function searchGlobalUnitsAction(rawQuery: string): Promise<{ units: GlobalUnitResult[]; truncated: boolean; error?: string }> {
  await requireSuperadmin();
  const query = rawQuery.trim().replace(/[%,()*_\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
  if (query.length < 2) return { units: [], truncated: false };
  const db = createAdminClient();
  const pattern = `%${query}%`;
  const communities = await db.from("communities").select("id,name,city").ilike("name", pattern).limit(LIMIT + 1);
  if (communities.error) return { units: [], truncated: false, error: "Unable to search communities." };
  const ids = (communities.data ?? []).map(c => c.id);
  const fields = "id,community_id,house_label,unit_reference,public_reference,is_active";
  const sources = await Promise.all([
    ...["house_label","unit_reference","public_reference"].map(field => db.from("houses").select(fields).ilike(field, pattern).order("house_label").limit(LIMIT + 1)),
    ids.length ? db.from("houses").select(fields).in("community_id", ids).order("house_label").limit(LIMIT + 1) : Promise.resolve({data: [], error: null}),
  ]);
  if (sources.some(source => source.error)) return { units: [], truncated: false, error: "Unable to search units." };
  const unique = [...new Map(sources.flatMap(source => source.data ?? []).map(h => [h.id,h])).values()];
  const selected = unique.slice(0, LIMIT);
  const communityIds = [...new Set(selected.map(h => h.community_id))];
  const context = communityIds.length ? await db.from("communities").select("id,name,city").in("id", communityIds) : {data: [], error: null};
  if (context.error) return { units: [], truncated: false, error: "Unable to load unit communities." };
  const names = new Map((context.data ?? []).map(c => [c.id,c]));
  return { truncated: unique.length > LIMIT || ids.length > LIMIT, units: selected.map(h => ({
    id: String(h.id), communityId: String(h.community_id), communityName: String(names.get(h.community_id)?.name ?? "Unknown community"),
    communityCity: String(names.get(h.community_id)?.city ?? ""), label: String(h.house_label),
    isActive: h.is_active === true, unitReference: String(h.unit_reference ?? ""), publicReference: String(h.public_reference ?? ""),
  })) };
}

export async function getGlobalUnitAction(communityId: string, unitId: string) {
  await requireSuperadmin();
  if (!UUID.test(communityId) || !UUID.test(unitId)) return null;
  const result = await getCommunityUnitDetailPageData(communityId, unitId);
  if (!result.unit || !result.community) return null;
  const relationships = await getUnitRelationshipsAction(communityId, unitId);
  return { unit: result.unit, houses: result.houses, relationships };
}

export async function getGlobalAccountByIdAction(communityId: string, userId: string): Promise<UserSearchItem | null> {
  await requireSuperadmin();
  if (!UUID.test(communityId) || !UUID.test(userId)) return null;
  const db = await createClient();
  const admin = createAdminClient();
  const [accounts, membership, profile, community, primary] = await Promise.all([
    db.rpc("sa_list_users", {p_community_id: communityId,p_search:null}),
    admin.from("community_members").select("user_id,role,is_active").eq("community_id",communityId).eq("user_id",userId).maybeSingle(),
    admin.from("profiles").select("user_id,username").eq("user_id",userId).eq("community_id",communityId).maybeSingle(),
    db.from("communities").select("id,name,city").eq("id",communityId).maybeSingle(),
    admin.from("house_residents").select("house_id").eq("community_id",communityId).eq("user_id",userId).eq("is_active",true).eq("is_primary",true),
  ]);
  if (accounts.error || membership.error || profile.error || community.error || primary.error || !membership.data || !community.data) return null;
  const row = (Array.isArray(accounts.data) ? accounts.data : []).find(item => coerceString(item.user_id || item.id) === userId && (!item.community_id || String(item.community_id) === communityId));
  if (!row) return null;
  const houseId = coerceString(row.house_id);
  return {source:"account", id:userId, communityId, communityName:coerceString(community.data.name), communityCity:coerceString(community.data.city), fullName:coerceString(row.full_name,"Unnamed user"), email:coerceString(row.email), username:coerceString(profile.data?.username), phone:coerceString(row.phone), houseId, houseLabel:coerceString(row.house_label), createdAt:coerceString(row.created_at), lastSignIn:coerceString(row.last_sign_in), isActive:coerceBoolean(membership.data.is_active), role:coerceString(membership.data.role), isPrimary:Boolean(houseId && primary.data?.some(item=>String(item.house_id)===houseId))};
}
