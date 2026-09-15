import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();
const migration = readFileSync(
  join(
    root,
    "supabase/migrations/20260914230000_fix_resident_provided_activation_house_binding.sql",
  ),
  "utf8",
);

test("resident-provided units stay staging-only until explicit confirmation", () => {
  assert.match(migration, /registration_mode <> 'resident_provided_units'/);
  assert.match(migration, /status not in \('reviewed', 'confirmed', 'processed'\)/);
  assert.match(
    migration,
    /Only now, once review is truly ready for external approval,[\s\S]*_cr_bind_operational_house_v1/,
  );
});

test("confirmation binds a resident-provided unit to exactly one operational house", () => {
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /normalize_unit_label\(h\.house_label\)/);
  assert.match(migration, /ENTRY_CR_OPERATIONAL_HOUSE_AMBIGUOUS/);
  assert.match(migration, /ENTRY_CR_OPERATIONAL_HOUSE_INACTIVE/);
  assert.match(migration, /insert into public\.houses/);
  assert.match(migration, /v_action := 'matched_existing'/);
  assert.match(migration, /v_action := 'created'/);
});

test("house identity propagates through registration and activation records", () => {
  assert.match(
    migration,
    /update public\.community_registration_units[\s\S]*set house_id = v_house_id/,
  );
  assert.match(
    migration,
    /update public\.community_registration_submissions[\s\S]*set house_id = v_house_id/,
  );
  assert.match(
    migration,
    /update public\.community_registration_residents[\s\S]*set house_id = v_house_id/,
  );
  assert.match(
    migration,
    /update public\.resident_activation_queue[\s\S]*set house_id = v_house_id/,
  );
  assert.match(migration, /activation_blocked_missing_house'[\s\S]*then null/);
});

test("terminal registration and activation states cannot regress to a null house", () => {
  assert.match(migration, /cr_units_terminal_requires_house/);
  assert.match(
    migration,
    /status not in \('confirmed', 'processed'\) or house_id is not null/,
  );
  assert.match(migration, /cr_submissions_terminal_requires_house/);
  assert.match(
    migration,
    /status not in \('confirmed', 'converted'\) or house_id is not null/,
  );
  assert.match(migration, /raq_registration_source_requires_house/);
  assert.match(
    migration,
    /source is distinct from 'community_registration_v1' or house_id is not null/,
  );
});

test("legacy broken resident-provided conversions are repaired generically", () => {
  assert.match(
    migration,
    /registration_mode = 'resident_provided_units'[\s\S]*u\.house_id is null[\s\S]*u\.status in \('confirmed', 'processed'\)/,
  );
  assert.match(
    migration,
    /perform public\._cr_bind_operational_house_v1\(v_row\.id\)/,
  );
});

test("null house comparisons use null-safe semantics during confirmation", () => {
  assert.match(
    migration,
    /v_submission\.house_id is distinct from v_unit\.house_id/,
  );
});
