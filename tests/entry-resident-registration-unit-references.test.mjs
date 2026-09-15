import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

test("registration units support optional presentation-only public references", () => {
  const migration = read(
    "supabase/migrations/20260915024500_entry_registration_unit_public_references.sql",
  );

  assert.match(migration, /add column if not exists public_reference text/);
  assert.match(
    migration,
    /set_community_registration_unit_public_references_v1/,
  );
  assert.match(migration, /registration_mode <> 'existing_units'/);
  assert.match(migration, /char_length\(v_reference\) > 160/);
  assert.match(migration, /normalized_unit_label = v_normalized_label/);
  assert.match(migration, /to service_role/);
});

test("public registration reads references only as optional helper metadata", () => {
  const resolver = read(
    "features/entry/communityRegistration/public/unitGuideReferences.ts",
  );
  const page = read("app/(public)/entry/register/[slug]/page.tsx");

  assert.match(resolver, /unit_label_snapshot,public_reference/);
  assert.match(resolver, /\.eq\("status", "unregistered"\)/);
  assert.match(resolver, /References are optional presentation metadata/);
  assert.match(page, /resolveCommunityRegistrationUnitReferences/);
  assert.match(page, /unitReferences=\{unitReferences\}/);
});

test("unit guide uses a fixed-height scrollable list and searches labels plus references", () => {
  const unitLookup = read(
    "features/entry/communityRegistration/public/UnitLookupForm.tsx",
  );

  assert.match(unitLookup, /unitReferences\?: Record<string, string>/);
  assert.match(unitLookup, /`\$\{unitLabel\} \$\{reference\}`/);
  assert.match(unitLookup, /max-h-\[21rem\] overflow-y-auto/);
  assert.match(unitLookup, /divide-y divide-slate-100/);
  assert.match(unitLookup, /Buscar por número o referencia/);
  assert.match(unitLookup, /aria-pressed=\{selected\}/);
  assert.match(unitLookup, /unitReferences\[unitLabel\]/);
});
