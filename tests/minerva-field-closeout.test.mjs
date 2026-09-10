import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();
function read(path) {
  return readFileSync(join(root, path), "utf8");
}

const peoplePage = read("app/(field)/field/entry/people/page.tsx");
const addUserPage = read("app/(field)/field/entry/people/new/page.tsx");
const residentPage = read(
  "app/(field)/field/entry/communities/[communityId]/people/residents/[userId]/page.tsx",
);
const residentActions = read("features/entry/field/FieldResidentActions.tsx");
const residentAccess = read("features/entry/field/residentAccessActions.ts");
const communityPage = read("app/(field)/field/entry/communities/[communityId]/page.tsx");
const communityStatus = read("features/entry/field/FieldCommunityStatusAction.tsx");
const communityStatusAction = read("features/entry/field/communityStatusActions.ts");
const registration = read("features/entry/field/FieldRegistrationCard.tsx");
const destinations = read("features/entry/field/FieldDestinationsCard.tsx");
const recoveryFunction = read("supabase/functions/admin-generate-recovery-code/index.ts");

function occursBefore(source, earlier, later) {
  const earlierIndex = source.indexOf(earlier);
  const laterIndex = source.indexOf(later);
  assert.notEqual(earlierIndex, -1, `missing ${earlier}`);
  assert.notEqual(laterIndex, -1, `missing ${later}`);
  assert.ok(earlierIndex < laterIndex, `${earlier} should appear before ${later}`);
}

test("global People mirrors Access hierarchy and reuses community-scoped creation", () => {
  assert.match(peoplePage, /Create or manage ENTRY users across communities/);
  assert.match(peoplePage, /href="\/field\/entry\/people\/new"/);
  assert.match(peoplePage, />\s*Add user\s*</);
  assert.match(peoplePage, /Find person to manage/);
  assert.match(peoplePage, /Search name, email or username/);
  occursBefore(peoplePage, "Add user", "Find person to manage");

  assert.match(addUserPage, /getCommunitiesWithProgressResult/);
  assert.match(addUserPage, /community\.isActive/);
  assert.match(addUserPage, /\/people\/new/);
  assert.doesNotMatch(addUserPage, /createUser|auth\.admin|service_role/i);
});

test("resident detail is person-first and follows approved visual hierarchy", () => {
  assert.match(residentPage, /<FieldResidentActions/);
  assert.match(residentPage, /Household/);
  assert.match(residentPage, /Account/);
  assert.match(residentPage, /<FieldUserStatusAction/);
  occursBefore(residentPage, "<FieldResidentActions", "Household");
  occursBefore(residentPage, "Household", "Account");
  occursBefore(residentPage, "Account", "<FieldUserStatusAction");
  assert.doesNotMatch(residentPage, /FieldResidentProfileEditor/);
});

test("resident quick actions are compact and reset mode adapts to login identity", () => {
  assert.match(residentActions, /Quick actions/);
  assert.match(residentActions, /Edit profile/);
  assert.match(residentActions, /Reset PIN/);
  assert.match(residentActions, /Reset access/);
  assert.match(residentActions, /Change unit/);
  assert.match(residentActions, /Temporary access PIN/);
  assert.match(residentActions, /Confirm reset access/);
  assert.match(residentActions, /Confirm unit change/);
  assert.match(residentActions, /updateFieldResidentProfile/);
  assert.match(residentActions, /resetFieldResidentAccess/);
});

test("username-only recovery invokes Edge Function with the authenticated operator session", () => {
  assert.match(residentAccess, /await requireSuperadmin\(\)/);
  assert.match(residentAccess, /const supabase = await createClient\(\)/);
  assert.match(residentAccess, /supabase\.functions\.invoke\(/);
  assert.match(residentAccess, /admin-generate-recovery-code/);
  assert.match(residentAccess, /target_user_id: userId/);
  assert.doesNotMatch(residentAccess, /createAdminClient|SERVICE_ROLE/);

  assert.match(recoveryFunction, /admin\.rpc\("is_superadmin"/);
  assert.match(recoveryFunction, /isCommunityAdmin/);
  assert.match(recoveryFunction, /if \(!isSuperadmin && !isCommunityAdmin\)/);
  assert.match(recoveryFunction, /targetProfile\.auth_type !== "username"/);
  assert.match(recoveryFunction, /targetUserId === callerId/);
  assert.match(recoveryFunction, /activation_type: "password_recovery"/);
  assert.doesNotMatch(recoveryFunction, /console\.(?:log|warn|error)\([^\n]*plainCode/);
});

test("community detail is an operations hub without completed setup noise", () => {
  assert.match(communityPage, /Community operations hub/);
  assert.match(communityPage, /Quick actions/);
  assert.match(communityPage, /Residents & units/);
  assert.match(communityPage, /href="#registration"/);
  assert.match(communityPage, /href="#destinations"/);
  assert.match(communityPage, /attentionItems\.length > 0/);
  assert.match(communityPage, /FieldCommunityStatusAction/);
  assert.doesNotMatch(communityPage, /Snapshot|Current aggregate state|Setup status|token-free/);
});

test("community deactivation reuses canonical lifecycle and is never delete", () => {
  assert.match(communityStatusAction, /await requireSuperadmin\(\)/);
  assert.match(communityStatusAction, /sa_set_community_active_status/);
  assert.match(communityStatusAction, /p_is_active: input\.isActive/);
  assert.doesNotMatch(communityStatusAction, /createAdminClient|\.delete\(/);

  assert.match(communityStatus, /Deactivate community/);
  assert.match(communityStatus, /Reactivate community/);
  assert.match(communityStatus, /Confirm deactivation/);
  assert.match(communityStatus, /does not delete the community, units, residents, or history/);
  assert.match(communityStatus, /isReadOnlyPreview/);
});

test("registration and destinations stay compact and operational", () => {
  assert.match(registration, /units completed/);
  assert.match(registration, /Share registration link/);
  assert.match(registration, /Copy link/);
  assert.match(registration, /View unit progress/);
  assert.doesNotMatch(registration, /Submitted[\s\S]*Participating[\s\S]*rounded-lg border[\s\S]*rounded-lg border/);

  assert.match(destinations, /Configured destinations/);
  assert.match(destinations, /slice\(0, 5\)/);
  assert.match(destinations, /Destination editing remains in Console/);
});
