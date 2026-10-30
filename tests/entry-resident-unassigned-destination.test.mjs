import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(path, "utf8");
const migration = read("supabase/migrations/20261030182000_entry_resident_unassigned_destination.sql");

test("Unassigned is a virtual destination, not a physical house", () => {
  const ui = read("features/entry/communities/UnitResidentActions.tsx");
  const action = read("features/entry/communities/residentMoveActions.ts");

  assert.match(ui, /UNASSIGNED_DESTINATION = "__unassigned__"/);
  assert.match(ui, /Unassigned — No unit/);
  assert.match(ui, /targetHouseId: toUnassigned \? null : targetHouseId/);
  assert.match(ui, /Unassign resident/);
  assert.match(ui, /account will be deactivated/);
  assert.match(action, /targetHouseId: string \| null/);
  assert.match(action, /sa_unassign_community_resident_unit_v1/);
  assert.match(action, /p_target_user_id: userId/);
  assert.match(action, /getEntryPreviewReadOnlyError/);
  assert.doesNotMatch(action, /create_houses_bulk|insert\(\{.*house_label/);
});

test("Atomic unassignment retains identity and audit but revokes every active household assignment", () => {
  assert.match(migration, /public\.sa_unassign_community_resident_unit_v1/);
  assert.match(migration, /security definer/i);
  assert.match(migration, /public\.is_superadmin\(v_actor_id\)/);
  assert.match(migration, /p_target_user_id = v_actor_id/);
  assert.match(migration, /Cannot unassign an active superadmin/);
  assert.match(migration, /Only resident accounts can be unassigned/);
  assert.match(migration, /from public\.profiles p[\s\S]*for update/);
  assert.match(migration, /update public\.house_residents hr[\s\S]*is_active = false,[\s\S]*is_primary = false,[\s\S]*is_primary_contact = false/);
  assert.match(migration, /set house_id = null,[\s\S]*role = 'UNASSIGNED'/);
  assert.match(migration, /update public\.community_members[\s\S]*role = 'UNASSIGNED'/);
  assert.match(migration, /RESIDENT_UNASSIGNED_FROM_UNIT/);
  assert.match(migration, /community_resident\.unassign_unit/);
  assert.doesNotMatch(migration, /delete from public\.(profiles|house_residents|community_members)/i);
  assert.doesNotMatch(migration, /delete from auth\.users/i);
});

test("Previously unassigned resident can be assigned without silently reactivating access", () => {
  const users = read("features/entry/users/actions.ts");
  const communityUsers = read("features/entry/users/CommunityUsersClient.tsx");
  const globalUsers = read("features/entry/users/UserSearch.tsx");

  assert.match(migration, /sa_reassign_unassigned_community_resident_v1/);
  assert.match(migration, /v_profile\.role::text <> 'UNASSIGNED'/);
  assert.match(migration, /v_profile\.is_active or v_member\.is_active/);
  assert.match(migration, /set house_id = p_target_house_id, role = 'RESIDENT'/);
  assert.match(migration, /on conflict \(user_id, community_id, house_id\)/);
  assert.match(migration, /is_active = false/);
  assert.match(migration, /UNASSIGNED_RESIDENT_ASSIGNED_TO_UNIT/);

  assert.match(users, /normalizedRole === "UNASSIGNED"/);
  assert.match(users, /sa_reassign_unassigned_community_resident_v1/);
  assert.match(users, /Assign this resident to a unit before reactivating/);
  assert.match(communityUsers, /roleFilter === "UNASSIGNED"/);
  assert.match(communityUsers, /setCommunityUserUnitAction/);
  assert.match(communityUsers, /Account remains inactive until you reactivate it/);
  assert.match(globalUsers, /wasUnassigned/);
  assert.match(globalUsers, /isActive: false/);
});

test("New SECURITY DEFINER functions revoke public/anonymous and require authentication", () => {
  assert.match(migration, /revoke all on function public\.sa_unassign_community_resident_unit_v1\(uuid, uuid\) from public, anon/);
  assert.match(migration, /grant execute on function public\.sa_unassign_community_resident_unit_v1\(uuid, uuid\) to authenticated, service_role/);
  assert.match(migration, /revoke all on function public\.sa_reassign_unassigned_community_resident_v1\(uuid, uuid, uuid\) from public, anon/);
  assert.match(migration, /grant execute on function public\.sa_reassign_unassigned_community_resident_v1\(uuid, uuid, uuid\) to authenticated, service_role/);
});
