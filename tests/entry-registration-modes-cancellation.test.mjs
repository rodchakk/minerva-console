import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

const migration = read(
  "supabase/migrations/20260914210000_entry_registration_modes_and_cancellation.sql",
);
const initialSchema = read(
  "supabase/migrations/20260806232141_create_entry_community_registration_schema_v1.sql",
);

test("registration campaigns persist an explicit mode and default legacy rows to existing units", () => {
  assert.match(migration, /add column if not exists registration_mode text not null default 'existing_units'/);
  assert.match(migration, /registration_mode in \('existing_units', 'resident_provided_units'\)/);
  assert.match(migration, /'registration_mode', v_registration_mode/);
});

test("resident-provided unit submissions stay in staging and do not create operational houses", () => {
  assert.match(migration, /v_campaign\.registration_mode = 'resident_provided_units'/);
  assert.match(migration, /insert into public\.community_registration_units/);
  assert.match(migration, /house_id,\s+unit_label_snapshot,\s+normalized_unit_label,\s+status/);
  assert.match(migration, /v_campaign\.community_id,\s+null,\s+v_display_label,\s+v_label,\s+'unregistered'/);
  assert.doesNotMatch(migration, /insert into public\.houses/i);
});

test("resident-provided duplicate prevention is server-side and race-safe", () => {
  assert.match(migration, /on conflict \(campaign_id, normalized_unit_label\) do nothing/);
  assert.match(migration, /'ENTRY_CR_UNIT_ALREADY_REGISTERED'/);
  assert.match(migration, /for update/);
  assert.match(`${initialSchema}\n${migration}`, /idx_cr_units_campaign_normalized_label_unique/);
});

test("campaign cancellation is a status change that preserves registration data", () => {
  assert.match(migration, /'cancelled'/);
  assert.match(migration, /cancel_community_registration_campaign_v1/);
  assert.match(migration, /status = 'cancelled'/);
  assert.match(migration, /'campaign_cancelled'/);
  assert.match(migration, /preserved_submission_count/);
  assert.doesNotMatch(migration, /delete from public\.community_registration_/i);
  assert.doesNotMatch(migration, /delete from public\.houses/i);
});

test("public duplicate responses do not expose resident information", () => {
  const gateway = read("features/entry/communityRegistration/public/gateway.ts");
  const unitRoute = read("app/(public)/entry/register/[slug]/unit/route.ts");
  const householdForm = read("features/entry/communityRegistration/public/HouseholdDraftForm.tsx");

  assert.match(gateway, /reason:\s*"already_registered"/);
  assert.match(unitRoute, /error:\s*"already_registered"/);
  assert.match(householdForm, /This unit has already been registered/);
  assert.doesNotMatch(unitRoute, /resident_count|submitted_at|full_name|email|phone/i);
});

test("internal campaign creation exposes both registration modes", () => {
  const consoleCard = read("features/entry/communityRegistration/admin/CommunityRegistrationCard.tsx");
  const fieldLaunch = read("features/entry/field/FieldRegistrationLaunchFlow.tsx");
  const actions = read("features/entry/communityRegistration/admin/actions.ts");

  for (const source of [consoleCard, fieldLaunch, actions]) {
    assert.match(source, /existing_units/);
    assert.match(source, /resident_provided_units/);
  }

  assert.match(consoleCard, /Residents provide their unit/);
  assert.match(fieldLaunch, /How will residents identify their unit\?/);
  assert.match(actions, /launch_community_registration_campaign_v3/);
});

test("resident-provided campaign progress omits unknowable percentages", () => {
  const adminCard = read("features/entry/communityRegistration/admin/CommunityRegistrationCard.tsx");
  const fieldCard = read("features/entry/field/FieldRegistrationCard.tsx");
  const progressPage = read("app/(field)/field/entry/communities/[communityId]/registration/page.tsx");
  const query = read("features/entry/communityRegistration/admin/queries.ts");
  const unknownAdminBlock = adminCard.slice(
    adminCard.indexOf(") : (", adminCard.indexOf("hasKnownCampaignTotal")),
    adminCard.indexOf('<div className="mt-4 flex', adminCard.indexOf("hasKnownCampaignTotal")),
  );
  const unknownFieldBlock = fieldCard.slice(
    fieldCard.indexOf("if (!hasKnownTotal)"),
    fieldCard.indexOf("return (", fieldCard.indexOf("if (!hasKnownTotal)") + 1),
  );

  assert.match(query, /hasKnownTotal/);
  assert.match(query, /campaign\.registrationMode === "existing_units"/);
  assert.match(unknownAdminBlock, /Units submitted/);
  assert.match(unknownAdminBlock, /Residents received/);
  assert.match(unknownAdminBlock, /Total participating units/);
  assert.match(unknownAdminBlock, /Unknown/);
  assert.doesNotMatch(unknownAdminBlock, /role="progressbar"|registrationProgress\.percent|%/);
  assert.match(unknownFieldBlock, /Units submitted/);
  assert.match(unknownFieldBlock, /Residents received/);
  assert.match(unknownFieldBlock, /Total participating units/);
  assert.match(unknownFieldBlock, /Unknown/);
  assert.doesNotMatch(unknownFieldBlock, /progressbar|percentage|%/);
  assert.match(progressPage, /Total participating units/);
});
