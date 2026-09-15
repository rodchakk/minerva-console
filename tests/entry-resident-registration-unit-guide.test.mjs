import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

test("resident registration exposes only currently unregistered campaign units to the optional guide", () => {
  const gateway = read("features/entry/communityRegistration/public/gateway.ts");
  const page = read("app/(public)/entry/register/[slug]/page.tsx");

  assert.match(gateway, /availableUnits: string\[\]/);
  assert.match(gateway, /registrationMode !== "existing_units"/);
  assert.match(gateway, /\.from\("community_registration_units"\)/);
  assert.match(gateway, /\.eq\("status", "unregistered"\)/);
  assert.match(gateway, /The guide is optional\. Registration must remain usable if this read fails\./);
  assert.match(page, /availableUnits=\{campaign\.availableUnits\}/);
  assert.match(page, /registrationMode=\{campaign\.registrationMode\}/);
});

test("unit guide is contextual, searchable, and does not replace the existing registration flow", () => {
  const unitLookup = read("features/entry/communityRegistration/public/UnitLookupForm.tsx");

  assert.match(unitLookup, /registrationMode === "existing_units" && availableUnits\.length > 0/);
  assert.match(unitLookup, /¿Necesitas ayuda para identificar tu unidad\?/);
  assert.match(unitLookup, /Buscar en unidades disponibles/);
  assert.match(unitLookup, /No selecciones una unidad al azar/);
  assert.match(unitLookup, /selectAvailableUnit\(unitLabel\)/);
  assert.match(unitLookup, /<HouseholdDraftForm/);
  assert.match(unitLookup, /\/entry\/register\/\$\{encodeURIComponent\(slug\)\}\/unit/);
});

test("coded unit labels such as C1301 can be entered without forcing a configured Casa prefix", () => {
  const unitLookup = read("features/entry/communityRegistration/public/UnitLookupForm.tsx");
  const unitRoute = read("app/(public)/entry/register/[slug]/unit/route.ts");

  assert.match(unitLookup, /availableUnits\.every\(\(unitLabel\) =>[\s\S]*unitLabelHasPrefix/);
  assert.match(unitLookup, /showUnitLabelPrefix \? \(/);
  assert.match(unitRoute, /candidates\.add\(raw\)/);
  assert.match(unitRoute, /buildCommunityUnitLookupLabel\(unitLabelPrefix, raw\)/);
});
