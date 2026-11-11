import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type DirectoryUnit = {
  id: string;
  label: string;
  publicReference: string;
  unitReference: string;
  residents: { fullName: string; isActive: boolean }[];
};

export type DirectoryLink = { unit_a_id: string; unit_b_id: string };

type PageResult = { data: unknown[] | null; error: { message: string } | null };
type PaginatedQuery = { range: (start: number, end: number) => PromiseLike<PageResult> };

// Always page explicitly: Supabase/PostgREST defaults to a maximum of 1,000 rows.
// A silent cutoff could make the patronato incorrectly conclude residents are missing.
async function readAll(query: PaginatedQuery, label: string): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  const size = 500;
  for (let start = 0; ; start += size) {
    if (start > 100000) throw new Error("Directory export exceeds supported pagination size: " + label);
    const { data, error } = await query.range(start, start + size - 1);
    if (error || !Array.isArray(data)) throw new Error("Directory export source unavailable: " + label);
    rows.push(...data as Record<string, unknown>[]);
    if (data.length < size) return rows;
  }
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function getCommunityDirectoryExport(communityId: string) {
  // Caller MUST requireSuperadmin() and verify the community exists before invoking.
  // Server-only admin client; every source query is constrained to this community.
  const db = createAdminClient();
  const [houses, assignments, profiles, memberships, links] = await Promise.all([
    readAll(db.from("houses").select("id,house_label,is_active,public_reference,unit_reference")
      .eq("community_id", communityId).order("id", { ascending: true }), "houses"),
    readAll(db.from("house_residents").select("id,house_id,user_id,is_active")
      .eq("community_id", communityId).eq("is_active", true).order("id", { ascending: true }), "house_residents"),
    readAll(db.from("profiles").select("user_id,full_name,is_active")
      .eq("community_id", communityId).order("user_id", { ascending: true }), "profiles"),
    readAll(db.from("community_members").select("user_id,role,is_active")
      .eq("community_id", communityId).order("user_id", { ascending: true }), "community_members"),
    readAll(db.from("entry_unit_links").select("unit_a_id,unit_b_id")
      .eq("community_id", communityId).is("ended_at", null).order("id", { ascending: true }), "entry_unit_links"),
  ]);
  const knownHouseIds = new Set(houses.map(h => asString(h.id)));
  const memberMap = new Map(memberships.map(row => [asString(row.user_id), row]));
  const profileMap = new Map(profiles.map(row => [asString(row.user_id), row]));
  const namesByHouseId = new Map<string, Set<string>>();

  for (const assignment of assignments) {
    const houseId = asString(assignment.house_id);
    const userId = asString(assignment.user_id);
    if (!houseId || !userId || !knownHouseIds.has(houseId)) {
      throw new Error("Directory export contains orphaned active resident assignment");
    }
    const membership = memberMap.get(userId);
    const profile = profileMap.get(userId);
    // Exclude genuinely inactive accounts, but fail closed on orphaned accounts.
    if (!membership || !profile) throw new Error("Directory export contains an active resident without profile or membership");
    if (membership.is_active === false || profile.is_active === false) continue;
    const role = asString(membership.role).toUpperCase();
    if (role === "GUARD") continue;
    const name = asString(profile.full_name) || "Nombre por confirmar";
    if (!namesByHouseId.has(houseId)) namesByHouseId.set(houseId, new Set());
    namesByHouseId.get(houseId)!.add(name);
  }

  const units: DirectoryUnit[] = houses.map(house => ({
    id: asString(house.id),
    label: asString(house.house_label) || "Unidad sin nombre",
    publicReference: asString(house.public_reference),
    unitReference: asString(house.unit_reference),
    residents: Array.from(namesByHouseId.get(asString(house.id)) ?? [])
      .sort((a, b) => a.localeCompare(b, "es"))
      .map(fullName => ({ fullName, isActive: true })),
  }));
  const connections: DirectoryLink[] = links.map(link => ({
    unit_a_id: asString(link.unit_a_id),
    unit_b_id: asString(link.unit_b_id),
  }));
  if (connections.some(link => !knownHouseIds.has(link.unit_a_id) || !knownHouseIds.has(link.unit_b_id))) {
    throw new Error("Directory export contains link outside selected community");
  }
  return { units, links: connections };
}
