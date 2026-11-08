import "server-only";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { UnitRelationshipsPanel } from "@/features/entry/communities/UnitRelationshipsPanel";
import { searchCommunityMemberOptions, searchRelationshipUnits } from "@/features/entry/communities/unitRelationshipActions";
import { createAdminClient } from "@/lib/supabase/admin";

export async function UnitRelationshipsSection({ communityId, unitId, unitLabel }: { communityId: string; unitId: string; unitLabel: string }) {
  await requireSuperadmin();
  const db = createAdminClient();
  const [{ data: setting, error: settingError }, { data: linkRows, error: linksError }, { data: responsibilityRows, error: responsibilitiesError }, unitOptions, peopleOptions] = await Promise.all([
    db.from("community_settings").select("allow_unit_relationships").eq("community_id", communityId).maybeSingle(),
    db.from("entry_unit_links").select("id,unit_a_id,unit_b_id").eq("community_id", communityId).is("ended_at", null).or(`unit_a_id.eq.${unitId},unit_b_id.eq.${unitId}`),
    db.from("entry_unit_responsibilities").select("id,user_id").eq("community_id", communityId).eq("house_id", unitId).is("ended_at", null),
    searchRelationshipUnits(communityId),
    searchCommunityMemberOptions(communityId),
  ]);
  if (settingError || linksError || responsibilitiesError) return <p role="alert">Unit relationships are unavailable. Check the database migration and try again.</p>;
  if (setting?.allow_unit_relationships !== true) return <section className="rounded-xl border border-[var(--border)] p-5"><h2 className="font-semibold text-white">Unit relationships</h2><p className="mt-2 text-sm text-[var(--text-muted)]">This feature is not enabled for this community.</p></section>;

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
  return <UnitRelationshipsPanel communityId={communityId} unitId={unitId} unitLabel={unitLabel} units={unitOptions.options} people={peopleOptions.options} peopleHasMore={peopleOptions.hasMore} links={links} responsibilities={responsibilities} selectorError={selectorError || null} />;
}
