import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import ts from "typescript";
import * as React from "react";

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
const reviewWorkspace = read(
  "features/entry/communityRegistration/review/ReviewWorkspace.tsx",
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
  assert.match(reviewWorkspace, /resident\.position === 1[\s\S]*Titular/);

  const makePrimaryFunction = householdForm.match(
    /function makeResidentPrimary[\s\S]*?setSubmitError\(null\);\s*}/,
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

test("resident-provided registration requires acceptance before resident entry; existing units bypass it", () => {
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
  assert.match(householdForm, /canEnterResidents = !isResidentProvidedUnit \|\| referenceAccepted/);
  assert.match(householdForm, /: canEnterResidents \? \(/);
  assert.match(householdForm, /Continuar a residentes/);
  assert.doesNotMatch(householdForm, /Referencia de la vivienda[^\n]*opcional/);
});

test("reference acceptance rejects whitespace and oversize input, trims valid input and preserves residents", () => {
  const source = householdForm.match(/function acceptUnitReference[\s\S]*?scrollRegistrationToTop\(\);\s*}/)?.[0];
  assert.ok(source);
  for (const [draft, expected] of [[" \t\n ", false], ["x".repeat(161), false], ["  frente al parque  ", true]]) {
    let accepted = false;
    let error = null;
    let saved = draft;
    const factory = new Function("normalizedUnitReference", "UNIT_REFERENCE_MAX_LENGTH", "setReferenceError", "setUnitReferenceDraft", "setReferenceAccepted", "scrollRegistrationToTop",
      ts.transpile(source, { target: ts.ScriptTarget.ES2020 }) + "; return acceptUnitReference;");
    factory(draft.trim(), 160, (value) => { error = value; }, (value) => { saved = value; }, (value) => { accepted = value; }, () => {})({ preventDefault() {} });
    assert.equal(accepted, expected);
    assert.equal(Boolean(error), !expected);
    if (expected) assert.equal(saved, "frente al parque");
  }
  assert.doesNotMatch(source, /setResidents|setSavedResidentIds|setActiveResidentId/);
  const editReference = householdForm.match(/onClick=\{\(\) => \{\s*setReferenceAccepted\(false\);[\s\S]*?Editar referencia/)?.[0];
  assert.ok(editReference);
  assert.doesNotMatch(editReference, /setResidents|setSavedResidentIds|setActiveResidentId/);
});

test("resident form defaults first resident to Titular and reassigns exactly one without changing ownership", () => {
  assert.match(householdForm, /type="checkbox"[\s\S]*checked=\{residents\[0\]\?\.id === activeResident.id\}[\s\S]*onChange=\{\(\) => makeResidentPrimary\(activeResident.id\)\}/);
  assert.match(householdForm, /Titular de la vivienda/);
  assert.match(householdForm, /Esta persona será el contacto principal de esta vivienda\./);
  const source = householdForm.match(/function makeResidentPrimary[\s\S]*?setSubmitError\(null\);\s*}/)?.[0];
  let residents = [{ id: 1, relationship: "tenant", isOwnerReference: false }, { id: 2, relationship: "owner", isOwnerReference: true }];
  const originals = [...residents];
  const factory = new Function("setResidents", "setReviewResidents", "setStep", "setDraftNotice", "setSubmitError",
    ts.transpile(source, { target: ts.ScriptTarget.ES2020 }) + "; return makeResidentPrimary;");
  const select = factory((update) => { residents = update(residents); }, () => {}, () => {}, () => {}, () => {});
  assert.equal(residents[0].id, 1);
  select(2);
  assert.deepEqual(residents.map((resident) => resident.id), [2, 1]);
  select(2);
  assert.equal(residents.filter((resident) => resident.id === residents[0].id).length, 1);
  assert.equal(residents[0], originals[1]);
  assert.equal(residents[1], originals[0]);
});

function renderHousehold(registrationMode) {
  const state = [];
  let cursor = 0;
  const react = {
    ...React,
    useEffect() {},
    useMemo: (compute) => compute(),
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], (update) => {
        state[index] = typeof update === "function" ? update(state[index]) : update;
      }];
    },
  };
  const exports = {};
  const compiled = ts.transpile(householdForm, {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.React,
  });
  new Function("require", "exports", "React", compiled)((name) => {
    if (name === "react") return react;
    if (name === "./PublicRegistrationShell") return { RegistrationStepper: () => null };
    if (name === "./submissionPayload") return {};
    throw new Error(`Unexpected import: ${name}`);
  }, exports, react);
  return () => {
    cursor = 0;
    const nodes = [];
    function visit(node) {
      if (Array.isArray(node)) return node.forEach(visit);
      if (!React.isValidElement(node)) return;
      if (typeof node.type === "function") return visit(node.type(node.props));
      nodes.push(node);
      visit(node.props.children);
    }
    visit(exports.HouseholdDraftForm({ registrationMode, residentLimit: 5, slug: "test", unitLabel: "10" }));
    return nodes;
  };
}

test("rendered reference gate blocks residents and reference editing retains the active resident draft", () => {
  const render = renderHousehold("resident_provided_units");
  let nodes = render();
  assert.equal(nodes.some((node) => node.props.id === "household-edit-title"), false);
  nodes.find((node) => node.props.id === "unit-reference").props.onChange({ target: { value: "   " } });
  render().find((node) => node.type === "form").props.onSubmit({ preventDefault() {} });
  assert.ok(render().find((node) => node.props.id === "unit-reference-error"));
  render().find((node) => node.props.id === "unit-reference").props.onChange({ target: { value: "  frente al parque  " } });
  render().find((node) => node.type === "form").props.onSubmit({ preventDefault() {} });
  nodes = render();
  assert.ok(nodes.find((node) => node.props.id === "household-edit-title"));
  nodes.find((node) => node.type === "button" && node.props.children === "Agregar residente").props.onClick();
  nodes = render();
  assert.equal(nodes.find((node) => node.props.type === "checkbox").props.checked, true);
  nodes.find((node) => node.props.id === "resident-1-name").props.onChange({ target: { value: "Ana Test" } });
  render().find((node) => node.type === "button" && node.props.children === "Editar referencia").props.onClick();
  assert.equal(render().some((node) => node.props.id === "resident-1-name"), false);
  render().find((node) => node.type === "form").props.onSubmit({ preventDefault() {} });
  assert.equal(render().find((node) => node.props.id === "resident-1-name").props.value, "Ana Test");
});

test("rendered existing-unit form allows residents without a reference gate", () => {
  const nodes = renderHousehold("existing_units")();
  assert.ok(nodes.find((node) => node.props.id === "household-edit-title"));
  assert.equal(nodes.some((node) => node.props.id === "unit-reference"), false);
});

test("resident-provided unit reference is staged without becoming an ownership marker", () => {
  assert.match(
    submissionMigration,
    /v_campaign\.registration_mode = 'resident_provided_units'/,
  );
  assert.match(submissionMigration, /unit_reference_snapshot/);
  assert.match(submissionMigration, /v_unit_reference/);
  assert.match(
    submissionMigration,
    /if v_campaign\.registration_mode = 'resident_provided_units' then[\s\S]*unit_reference_snapshot[\s\S]*v_unit_reference[\s\S]*else[\s\S]*select \* into v_unit/,
  );
  assert.doesNotMatch(
    submissionMigration,
    /else[\s\S]*unit_reference_snapshot[\s\S]*v_unit_reference[\s\S]*end if;/,
  );
  const residentProvidedInsert = submissionMigration.match(
    /if v_campaign\.registration_mode = 'resident_provided_units' then[\s\S]*?returning \* into v_unit;/,
  )?.[0];
  assert.ok(residentProvidedInsert);
  assert.doesNotMatch(residentProvidedInsert, /owner_id|property_owner/i);
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
