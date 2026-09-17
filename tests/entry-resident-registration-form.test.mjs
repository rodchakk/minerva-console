import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

const householdForm = read(
  "features/entry/communityRegistration/public/HouseholdDraftForm.tsx",
);
const unitLookup = read(
  "features/entry/communityRegistration/public/UnitLookupForm.tsx",
);
const submissionPayload = read(
  "features/entry/communityRegistration/public/submissionPayload.ts",
);
const gateway = read(
  "features/entry/communityRegistration/public/gateway.ts",
);
const submitRoute = read(
  "app/(public)/entry/register/[slug]/submit/route.ts",
);
const submissionMigration = read(
  "supabase/migrations/20260916220000_entry_registration_form_unit_reference.sql",
);
const bindingMigration = read(
  "supabase/migrations/20260916221000_entry_registration_form_reference_binding.sql",
);

test("titular is a registration primary-contact convention, not an ownership flag", () => {
  assert.match(householdForm, /Hacer titular/);
  assert.match(householdForm, /Contacto principal de esta vivienda/);
  assert.match(
    householdForm,
    /El titular es el contacto principal de este registro\. No significa que sea el propietario de la vivienda\./,
  );
  assert.match(householdForm, /resident\.position === 1/);
  assert.match(householdForm, /function makeResidentPrimary/);

  const makePrimaryFunction = householdForm.match(
    /function makeResidentPrimary[\s\S]*?\n  }\n\n  function addResident/,
  )?.[0];
  assert.ok(makePrimaryFunction);
  assert.doesNotMatch(makePrimaryFunction, /isOwnerReference|relationship/);
});

test("changing the titular reorders residents without changing owner semantics", () => {
  assert.match(
    householdForm,
    /return \[\s*selected,\s*\.\.\.current\.slice\(0, selectedIndex\),\s*\.\.\.current\.slice\(selectedIndex \+ 1\),\s*\]/,
  );
  assert.match(
    householdForm,
    /position: index \+ 1/,
  );
  assert.match(
    householdForm,
    /isOwnerReference: resident\.isOwnerReference/,
  );
});

test("resident-provided registration exposes an optional unit reference", () => {
  assert.match(
    unitLookup,
    /registrationMode=\{state\.result\.registrationMode \?\? registrationMode\}/,
  );
  assert.match(householdForm, /Referencia de la vivienda/);
  assert.match(householdForm, /registrationMode === "resident_provided_units"/);
  assert.match(householdForm, /unitReference: normalizedUnitReference/);
  assert.match(submissionPayload, /unitReference\?: string/);
  assert.match(submissionPayload, /UNIT_REFERENCE_MAX_LENGTH = 160/);
  assert.match(submitRoute, /unitReference: parsedBody\.body\.unitReference/);
  assert.match(gateway, /unit_reference: unitReference/);
});

test("resident-provided unit reference is staged without becoming an ownership marker", () => {
  assert.match(
    submissionMigration,
    /v_campaign\.registration_mode = 'resident_provided_units'/,
  );
  assert.match(submissionMigration, /unit_reference_snapshot/);
  assert.match(submissionMigration, /v_unit_reference/);
  assert.doesNotMatch(submissionMigration, /is_owner|owner_id|property_owner/i);
});

test("confirmed staging reference only fills a blank operational house reference", () => {
  assert.match(
    bindingMigration,
    /set unit_reference = v_unit\.unit_reference_snapshot/,
  );
  assert.match(
    bindingMigration,
    /nullif\(public\._cr_normalize_name_v1\(unit_reference\), ''\) is null/,
  );
  assert.match(
    bindingMigration,
    /unit_reference,\s+is_active[\s\S]*nullif\(public\._cr_normalize_name_v1\(v_unit\.unit_reference_snapshot\), ''\)/,
  );
});
