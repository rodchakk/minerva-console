import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

test("facilities workspace can create post-onboarding facilities through the existing bulk RPC", () => {
  const drawer = read("features/entry/communities/CommunityFacilitiesDrawer.tsx");
  const actions = read("features/entry/communities/actions.ts");
  const communityPage = read("app/(console)/products/entry/communities/[communityId]/page.tsx");

  assert.match(communityPage, /communityId=\{community\.id\}/);
  assert.match(drawer, /createCommunityFacilitiesAction/);
  assert.match(drawer, /Add facility/);
  assert.match(drawer, /router\.refresh\(\)/);
  assert.match(actions, /export async function createCommunityFacilitiesAction/);
  assert.match(actions, /rpc\(\s*"create_community_facilities_bulk_v1"/);
  assert.match(actions, /parseNamedList\(input\.facilityNames\)/);
});

test("admin-created user and resident forms avoid credential autofill and keep passwords masked with copy controls", () => {
  const usersClient = read("features/entry/users/CommunityUsersClient.tsx");
  const residentQuickCreate = read("features/entry/communities/ResidentQuickCreate.tsx");

  assert.match(usersClient, /name="entry_community_user_full_name"/);
  assert.match(usersClient, /name="entry_community_user_contact_email"/);
  assert.match(usersClient, /name="entry_community_user_temporary_password"/);
  assert.match(usersClient, /autoComplete="new-password"/);
  assert.match(usersClient, /showCreatePassword \? "text" : "password"/);
  assert.match(usersClient, /aria-label="Copy password"/);
  assert.match(residentQuickCreate, /name="entry_quick_resident_full_name"/);
  assert.match(residentQuickCreate, /name="entry_quick_resident_temporary_password"/);
  assert.match(residentQuickCreate, /autoComplete="new-password"/);
  assert.match(residentQuickCreate, /showPassword \? "text" : "password"/);
  assert.match(residentQuickCreate, /copyDraftPassword/);
});

test("admin console password creation uses the backend activation minimum without changing public activation", () => {
  const policy = read("features/entry/passwordPolicy.ts");
  const usersClient = read("features/entry/users/CommunityUsersClient.tsx");
  const userActions = read("features/entry/users/communityUserActions.ts");
  const unitActions = read("features/entry/communities/unitActions.ts");
  const publicActivation = read("app/activate/page.tsx");

  assert.match(policy, /ENTRY_ADMIN_TEMP_PASSWORD_MIN_LENGTH = 6/);
  assert.match(usersClient, /ENTRY_ADMIN_TEMP_PASSWORD_MIN_LENGTH/);
  assert.match(userActions, /ENTRY_ADMIN_TEMP_PASSWORD_MIN_LENGTH/);
  assert.match(unitActions, /ENTRY_ADMIN_TEMP_PASSWORD_MIN_LENGTH/);
  assert.match(publicActivation, /password\.length < 8/);
});

test("unit editing persists primary resident through house_residents.is_primary", () => {
  const detailQueries = read("features/entry/communities/detailQueries.ts");
  const quickActions = read("features/entry/communities/CommunityUnitQuickActions.tsx");
  const unitActions = read("features/entry/communities/unitActions.ts");

  assert.match(detailQueries, /primaryResidentId: string/);
  assert.match(detailQueries, /isPrimary: boolean/);
  assert.match(detailQueries, /\.from\("house_residents"\)[\s\S]*\.select\("house_id,user_id,is_primary"\)/);
  assert.match(detailQueries, /activeResidents\.find\(\(resident\) => resident\.isPrimary\)/);
  assert.match(quickActions, /Primary resident/);
  assert.match(quickActions, /primaryResidentUserId: hasLinkedResidents \? primaryResidentId : null/);
  assert.match(unitActions, /setPrimaryResidentForUnit/);
  assert.match(unitActions, /\.update\(\{ is_primary: false/);
  assert.match(unitActions, /\.update\(\{ is_primary: true/);
});

test("unit deactivation reuses the existing backend cascade and validates community scope", () => {
  const migration = read(
    "supabase/migrations/20260905172110_admin_toggle_house_propagate_resident_status.sql",
  );
  const unitActions = read("features/entry/communities/unitActions.ts");
  const quickActions = read("features/entry/communities/CommunityUnitQuickActions.tsx");

  assert.match(migration, /create or replace function public\.admin_toggle_house/);
  assert.match(migration, /deactivated_by_unit = true/);
  assert.match(migration, /update public\.profiles/);
  assert.match(migration, /update public\.community_members/);
  assert.match(migration, /is_community_admin\(v_cid, auth\.uid\(\)\)/);
  assert.match(unitActions, /loadUnitInCommunity\(\{ communityId, unitId \}\)/);
  assert.match(unitActions, /rpc\("admin_toggle_house"/);
  assert.doesNotMatch(unitActions, /rpc\("sa_set_community_unit_active_status"/);
  assert.doesNotMatch(quickActions, /Linked resident account states were not changed/);
});

test("Field unit discovery and quick resident validation reuse the canonical admin unit directory", () => {
  const peopleData = read("features/entry/field/peopleData.ts");
  const quickResidentActions = read("features/entry/field/quickResidentActions.ts");

  assert.match(peopleData, /rpc\("admin_list_houses", \{/);
  assert.match(peopleData, /p_community_id: communityId/);
  assert.doesNotMatch(
    peopleData,
    /\.from\("houses"\)[\s\S]*\.select\("id,house_label,is_active"\)/,
  );

  assert.match(quickResidentActions, /rpc\(\s*"admin_list_houses"/);
  assert.match(quickResidentActions, /coerceString\(item\.id\) === unitId/);
  assert.doesNotMatch(
    quickResidentActions,
    /\.from\("houses"\)[\s\S]*\.select\("id,house_label,is_active"\)/,
  );
});

test("Field keeps unit status recovery and destination visibility on the onsite community flow", () => {
  const communityPage = read(
    "app/(field)/field/entry/communities/[communityId]/page.tsx",
  );
  const destinations = read("features/entry/field/FieldDestinationsCard.tsx");
  const fieldUnitActions = read("features/entry/field/FieldUnitActions.tsx");
  const unitStatusActions = read("features/entry/field/unitStatusActions.ts");
  const unitActions = read("features/entry/communities/unitActions.ts");

  assert.match(communityPage, /FieldDestinationsCard/);
  assert.match(communityPage, /destinations=\{previews\.destinations\}/);
  assert.match(destinations, /Configured destinations/);
  assert.match(fieldUnitActions, /Reactivate unit/);
  assert.match(fieldUnitActions, /Residents previously deactivated by this unit/);
  assert.match(unitStatusActions, /setCommunityUnitActiveStatusAction/);
  assert.match(unitActions, /rpc\("admin_toggle_house"/);
});

test("Field unit search tolerates common zero-padded labels without breaking custom labels", () => {
  const peopleModel = read("features/entry/field/peopleModel.ts");

  assert.match(peopleModel, /function normalizeFieldUnitSearch/);
  assert.match(peopleModel, /function collapseNumericUnitTokens/);
  assert.match(peopleModel, /Number\.parseInt\(token, 10\)/);
  assert.match(peopleModel, /normalizedLabel\.includes\(normalized\)/);
  assert.match(peopleModel, /collapsedLabel\.includes\(collapsedQuery\)/);
});
