"use server";

import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { createAdminClient } from "@/lib/supabase/admin";
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
  const byLabel = db.from("houses").select(fields).or(`house_label.ilike.${pattern},unit_reference.ilike.${pattern},public_reference.ilike.${pattern}`).order("house_label").limit(LIMIT + 1);
  const [labels, byCommunity] = await Promise.all([byLabel, ids.length ? db.from("houses").select(fields).in("community_id", ids).order("house_label").limit(LIMIT + 1) : Promise.resolve({data: [], error: null})]);
  if (labels.error || byCommunity.error) return { units: [], truncated: false, error: "Unable to search units." };
  const unique = [...new Map([...(labels.data ?? []), ...(byCommunity.data ?? [])].map(h => [h.id,h])).values()];
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
