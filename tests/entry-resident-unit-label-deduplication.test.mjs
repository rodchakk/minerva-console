import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import ts from "typescript";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

const unitLabelPrefixSource = read(
  "features/entry/communityRegistration/public/unitLabelPrefix.ts",
);
const unitRoute = read(
  "app/(public)/entry/register/[slug]/unit/route.ts",
);
const submitRoute = read(
  "app/(public)/entry/register/[slug]/submit/route.ts",
);

function loadUnitLabelHelpers() {
  const compiled = ts.transpile(unitLabelPrefixSource, {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.CommonJS,
  });
  const exports = {};
  new Function("exports", compiled)(exports);
  return exports;
}

test("resident-provided unit labels canonicalize to one configured identity", () => {
  const { canonicalizeCommunityUnitLabel } = loadUnitLabelHelpers();

  assert.equal(canonicalizeCommunityUnitLabel("Casas", "2008"), "Casa 2008");
  assert.equal(
    canonicalizeCommunityUnitLabel("Casas", "Casa 2008"),
    "Casa 2008",
  );
  assert.equal(
    canonicalizeCommunityUnitLabel("Casas", "casa   2008"),
    "Casa 2008",
  );
  assert.equal(
    canonicalizeCommunityUnitLabel("Casas", "  2008  "),
    "Casa 2008",
  );
});

test("unit lookup stops when the canonical identity is already registered", () => {
  assert.match(
    unitRoute,
    /if \(lookup\.available \|\| lookup\.reason === "already_registered"\) \{\s*break;/,
  );
  assert.match(
    unitRoute,
    /const canonical = buildCommunityUnitLookupLabel\(unitLabelPrefix, raw\);[\s\S]*candidates\.add\(canonical\)[\s\S]*candidates\.add\(raw\)/,
  );
});

test("final submit re-resolves and canonicalizes resident-provided labels server-side", () => {
  assert.match(submitRoute, /lookupCommunityRegistrationUnit\(\{/);
  assert.match(
    submitRoute,
    /unitLookup\.registrationMode === "resident_provided_units"/,
  );
  assert.match(submitRoute, /resolveCommunityRegistrationUnitPrefix\(\{/);
  assert.match(
    submitRoute,
    /submissionUnitLabel = canonicalizeCommunityUnitLabel\(/,
  );
  assert.match(
    submitRoute,
    /unitLabel: submissionUnitLabel/,
  );
});
