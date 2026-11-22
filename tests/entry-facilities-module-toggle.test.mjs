import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("Facilities reads authoritative community switch even if facilities exist", () => {
  const queries = read("features/entry/communities/detailQueries.ts");
  assert.match(queries, /settingsData\?\.allow_reservations === true/);
  assert.match(queries, /state: !allowReservations \? "disabled" : items\.length > 0 \? "live" : "empty"/);
  assert.doesNotMatch(queries, /allow_reservations === undefined\s*\?\s*true/);
});

test("Community Facilities drawer offers a working ON/OFF switch", () => {
  const drawer = read("features/entry/communities/CommunityFacilitiesDrawer.tsx");
  assert.match(drawer, /updateCommunityReservationsAction\(\{ communityId, enabled \}\)/);
  assert.match(drawer, /Disable Facilities/);
  assert.match(drawer, /Enable Facilities/);
  assert.match(drawer, /window\.confirm\(/);
  assert.match(drawer, /router\.refresh\(\)/);
  assert.match(drawer, /state === "unavailable" \|\| isUpdatingModule/);
});

test("Facility enable/disable control calls a superadmin-only server action", () => {
  const drawer = read("features/entry/communities/CommunityFacilitiesDrawer.tsx");
  const actions = read("features/entry/communities/actions.ts");
  assert.match(drawer, /updateCommunityFacilityStateAction\(\{/);
  assert.match(actions, /export async function updateCommunityFacilityStateAction/);
  assert.match(actions, /await requireSuperadmin\(\)/);
  assert.match(actions, /getEntryPreviewReadOnlyError\(\)/);
  assert.match(actions, /\.eq\("community_id", communityId\)/);
  assert.match(actions, /superadmin_upsert_community_facility/);
});

test("Module toggle uses audited backend settings RPC, not direct table UPDATE", () => {
  const actions = read("features/entry/communities/actions.ts");
  const block = actions.split("export async function updateCommunityReservationsAction")[1]
    ?.split("export async function updateCommunityFacilityStateAction")[0];
  assert.ok(block);
  assert.match(block, /await requireSuperadmin\(\)/);
  assert.match(block, /getEntryPreviewReadOnlyError\(\)/);
  assert.match(block, /update_community_settings_v1/);
  assert.match(block, /p_allow_reservations: input\.enabled/);
  assert.match(block, /updated\.allow_reservations !== input\.enabled/);
  assert.doesNotMatch(block, /\.update\(/);
});

test("Database migration gates SECURITY DEFINER reads and fails closed", () => {
  const sql = read("supabase/migrations/20261121235000_enforce_facilities_community_switch.sql");
  for (const fn of [
    "resident_list_community_facilities",
    "admin_list_community_facilities",
    "admin_list_facility_reservations",
    "list_my_facility_reservations",
    "get_facility_availability",
  ]) {
    assert.match(sql, new RegExp("CREATE OR REPLACE FUNCTION public\\." + fn + "\\("));
  }
  assert.equal((sql.match(/\$function\$;/g) || []).length, 7);
  assert.match(sql, /allow_reservations IS TRUE/);
  assert.match(sql, /RAISE EXCEPTION 'reservations_disabled'/);
  assert.match(sql, /DROP POLICY IF EXISTS community_facilities_feature_enabled_select/);
  assert.match(sql, /DROP POLICY IF EXISTS facility_reservations_feature_enabled_select/);
  assert.match(sql, /coalesce\(v_allow_reservations, false\) = false/);
  assert.match(sql, /coalesce\(v_allow_reservations, false\) = true/);
});
