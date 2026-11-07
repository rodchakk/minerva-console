import "server-only";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { UnitRelationshipsPanel } from "@/features/entry/communities/UnitRelationshipsPanel";
import { createAdminClient } from "@/lib/supabase/admin";

export async function UnitRelationshipsSection({ communityId, unitId, unitLabel }: { communityId: string; unitId: string; unitLabel: string }) {
  await requireSuperadmin();
  const db = createAdminClient();
  const [{ data: setting }, { data: allUnits }, { data: profiles }, { data: linkRows }, { data: responsibilityRows }] = await Promise.all([
    db.from("community_settings").select("allow_unit_relationships").eq("community_id", communityId).maybeSingle(),
    db.from("houses").select("id,house_label,public_reference,unit_reference").eq("community_id", communityId).order("house_label").limit(3000),
    db.from("profiles").select("user_id,full_name,role,is_active").eq("community_id", communityId).order("full_name").limit(3000),
    db.from("entry_unit_links").select("id,unit_a_id,unit_b_id").eq("community_id", communityId).is("ended_at", null).or(`unit_a_id.eq.${unitId},unit_b_id.eq.${unitId}`),
    db.from("entry_unit_responsibilities").select("id,user_id").eq("community_id", communityId).eq("house_id", unitId).is("ended_at", null),
  ]);
  if (setting?.allow_unit_relationships !== true) return <section className="rounded-xl border border-[var(--border)] p-5"><h2 className="font-semibold text-white">Unit relationships</h2><p className="mt-2 text-sm text-[var(--text-muted)]">This feature is not enabled for this community.</p></section>;
  const unitMap = new Map((allUnits ?? []).map((x) => [String(x.id), x]));
  const profileMap = new Map((profiles ?? []).map((x) => [String(x.user_id), x]));
  const links = (linkRows ?? []).flatMap((row) => {
    const id = String(row.unit_a_id) === unitId ? String(row.unit_b_id) : String(row.unit_a_id);
    const unit = unitMap.get(id);
    return unit ? [{ id: String(row.id), unitId: id, label: `${unit.house_label} · ${unit.public_reference ?? unit.unit_reference ?? id.slice(0, 8)}` }] : [];
  });
  const responsibilities = (responsibilityRows ?? []).flatMap((row) => {
    const userId = String(row.user_id); const person = profileMap.get(userId);
    return person ? [{ id: String(row.id), userId, label: String(person.full_name), role: String(person.role), active: person.is_active === true }] : [];
  });
  const units = (allUnits ?? []).map((x) => ({ id: String(x.id), label: `${x.house_label} · ${x.public_reference ?? x.unit_reference ?? String(x.id).slice(0, 8)}` }));
  const people = (profiles ?? []).map((x) => ({ id: String(x.user_id), label: `${x.full_name} · ${x.role}${x.is_active ? "" : " · inactive"}` }));
  return <UnitRelationshipsPanel communityId={communityId} unitId={unitId} unitLabel={unitLabel} units={units} people={people} links={links} responsibilities={responsibilities} />;
}
