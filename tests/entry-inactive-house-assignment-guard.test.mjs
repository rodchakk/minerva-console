import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();
const migration = readFileSync(
  join(root, "supabase/migrations/20261023054000_entry_inactive_house_assignment_guard.sql"),
  "utf8",
);

test("inactive-house guard uses a locked, same-community check", () => {
  assert.match(migration, /where h\.id = p_house_id[\s\S]*h\.community_id = p_community_id[\s\S]*for share/i);
  assert.match(migration, /v_active is distinct from true/);
  assert.match(migration, /raise exception 'house_inactive'/);
  assert.match(migration, /raise exception 'house_not_in_community'/);
  assert.match(migration, /security definer/);
  assert.match(migration, /revoke all on function public\.entry_assert_active_house_assignment_v1/);
});

test("new active profiles and memberships cannot target inactive homes", () => {
  assert.match(migration, /tg_table_name = 'profiles'/);
  assert.match(migration, /tg_table_name = 'house_residents'/);
  assert.match(migration, /trg_entry_guard_active_profile_house_v1[\s\S]*before insert or update of house_id, community_id, is_active/);
  assert.match(migration, /trg_entry_guard_active_membership_house_v1[\s\S]*before insert or update of house_id, community_id, is_active, is_primary/);
  assert.match(migration, /if coalesce\(new\.is_active, false\) = false then/);
  assert.match(migration, /new\.house_id is null or coalesce\(new\.is_active, false\) = false/);
});

test("PIN issuance and pending invitations cannot bypass inactive-house checks", () => {
  assert.match(migration, /tg_table_name = 'resident_activation_pins'/);
  assert.match(migration, /trg_entry_guard_pending_pin_house_v1[\s\S]*before insert or update of queue_id, community_id, status, pin_hash, expires_at/);
  assert.match(migration, /where q\.id = new\.queue_id and q\.community_id = new\.community_id/);
  assert.match(migration, /tg_table_name = 'resident_invites'/);
  assert.match(migration, /trg_entry_guard_pending_invite_house_v1[\s\S]*before insert or update of house_id, community_id, status/);
  assert.match(migration, /if new\.status <> 'PENDING' then/);
});

test("migration does not change existing residents or house statuses", () => {
  assert.doesNotMatch(migration, /\bupdate\s+public\.(?:profiles|houses|house_residents|resident_activation_queue)\s+set\b/i);
  assert.doesNotMatch(migration, /\bdelete\s+from\s+public\./i);
  assert.doesNotMatch(migration, /\balter\s+table\s+public\.houses/i);
});

test("PIN generation provides an actionable inactive-unit error", () => {
  const actions = readFileSync(
    join(root, "features/entry/activation/pinActions.ts"),
    "utf8",
  );
  assert.match(actions, /item\.status === "failed" && item\.message\?\.includes\("house_inactive"\)/);
  assert.match(actions, /This unit is inactive\. Activate it before issuing a PIN or creating a resident/);
});
