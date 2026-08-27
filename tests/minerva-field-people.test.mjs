import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  canSendResidentResetEmail,
  canUseResidentRecoveryCode,
  filterFieldActivationRows,
  filterFieldResidents,
  filterFieldUnits,
  formatFieldUnitResidentCount,
  getFieldResidentAssignmentUnits,
  isActivationPinEligible,
} from "../features/entry/field/peopleModel.ts";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function assertOccursBefore(source, earlier, later) {
  const earlierIndex = source.indexOf(earlier);
  const laterIndex = source.indexOf(later);

  assert.notEqual(earlierIndex, -1, earlier);
  assert.notEqual(laterIndex, -1, later);
  assert.ok(
    earlierIndex < laterIndex,
    `${earlier} should appear before ${later}`,
  );
}

const peopleFiles = [
  "app/(field)/field/entry/communities/[communityId]/people/page.tsx",
  "app/(field)/field/entry/communities/[communityId]/people/residents/[userId]/page.tsx",
  "app/(field)/field/entry/communities/[communityId]/people/units/[unitId]/page.tsx",
  "app/(field)/field/entry/communities/[communityId]/people/activation/[queueId]/page.tsx",
  "features/entry/field/FieldPeopleOverview.tsx",
  "features/entry/field/FieldResidentActions.tsx",
  "features/entry/field/FieldUnitActions.tsx",
  "features/entry/field/FieldActivationActions.tsx",
  "features/entry/field/peopleActions.ts",
  "features/entry/field/peopleData.ts",
  "features/entry/field/peopleModel.ts",
];

const peopleUiFiles = peopleFiles.filter(
  (file) => file !== "features/entry/field/peopleActions.ts",
);

test("Field community overview exposes Residents & units entry point", () => {
  const overview = read("app/(field)/field/entry/communities/[communityId]/page.tsx");

  assert.match(overview, /Residents & units/);
  assert.match(overview, /\/field\/entry\/communities\/\$\{encodeURIComponent\(community\.id\)\}\/people/);
  assert.doesNotMatch(overview, /\/products\/entry/);
});

test("Field people routes exist and stay Field-only", () => {
  for (const file of peopleUiFiles) {
    const source = read(file);

    assert.doesNotMatch(source, /\/products\/entry/, file);
    assert.doesNotMatch(source, /ActivationQueueTable/, file);
    assert.doesNotMatch(source, /localStorage|sessionStorage|document\.cookie|query params/i, file);
  }
});

test("Field people read model preserves unavailable states", () => {
  const data = read("features/entry/field/peopleData.ts");
  const overview = read("features/entry/field/FieldPeopleOverview.tsx");
  const unitPage = read(
    "app/(field)/field/entry/communities/[communityId]/people/units/[unitId]/page.tsx",
  );
  const residentPage = read(
    "app/(field)/field/entry/communities/[communityId]/people/residents/[userId]/page.tsx",
  );
  const residentActions = read("features/entry/field/FieldResidentActions.tsx");
  const unitActions = read("features/entry/field/FieldUnitActions.tsx");

  assert.match(data, /state: "unavailable"/);
  assert.match(data, /loadResidents/);
  assert.match(data, /loadUnits/);
  assert.match(data, /loadActivation/);
  assert.match(data, /residentCount: residentCountsByUnit[\s\S]*: null/);
  assert.doesNotMatch(data, /safeResidents/);
  assert.match(overview, /UnavailableState/);
  assert.match(overview, /Resident list/);
  assert.match(overview, /Unit list/);
  assert.match(overview, /Activation queue/);
  assert.match(overview, /formatFieldUnitResidentCount/);
  assert.match(unitPage, /Linked residents unavailable/);
  assert.match(unitPage, /No residents are linked to this unit/);
  assert.match(unitPage, /data\.residentsForUnit\.state === "unavailable"/);
  assert.match(residentPage, /unitState=\{data\.units\.state\}/);
  assert.match(residentActions, /Unit list unavailable/);
  assert.match(unitActions, /Resident choices unavailable/);
});

test("Field assignment and reset actions resolve canonical server-side data", () => {
  const actions = read("features/entry/field/peopleActions.ts");

  assert.match(actions, /loadCanonicalResident/);
  assert.match(actions, /sa_list_community_users/);
  assert.match(actions, /sa_update_community_user/);
  assert.match(actions, /\.from\("houses"\)/);
  assert.match(actions, /Only residents can be assigned from Field/);
  assert.doesNotMatch(actions, /formData\.get\("email"\)/);
  assert.doesNotMatch(actions, /formData\.get\("role"\)/);
});

test("Field mutations require explicit confirmation and Preview disables controls", () => {
  const residentActions = read("features/entry/field/FieldResidentActions.tsx");
  const unitActions = read("features/entry/field/FieldUnitActions.tsx");
  const activationActions = read("features/entry/field/FieldActivationActions.tsx");

  assert.match(residentActions, /Confirm unit change/);
  assert.match(residentActions, /Confirm reset access/);
  assert.match(unitActions, /Confirm rename/);
  assert.match(unitActions, /Confirm assignment/);
  assert.match(activationActions, /Confirm PIN generation/);
  assert.match(activationActions, /Confirm account creation/);

  for (const source of [residentActions, unitActions, activationActions]) {
    assert.match(source, /isReadOnlyPreview/);
    assert.match(source, /disabled=\{[^}]*isReadOnlyPreview/s);
  }
});

test("Unit rename hardening checks zero-row update and Field revalidation", () => {
  const unitActions = read("features/entry/communities/unitActions.ts");

  assert.match(unitActions, /\.select\("id"\)/);
  assert.match(unitActions, /\.maybeSingle\(\)/);
  assert.match(unitActions, /Unit not found in this community/);
  assert.match(unitActions, /\/field\/entry\/communities\/\$\{communityId\}\/people/);
});

test("Activation PIN and Create Account are single-row Field actions", () => {
  const actions = read("features/entry/field/peopleActions.ts");
  const activationActions = read("features/entry/field/FieldActivationActions.tsx");

  assert.match(actions, /generateActivationPins/);
  assert.match(actions, /queueIds: \[queueId\]/);
  assert.match(actions, /createActivatedUsers/);
  assert.match(actions, /queueIds: \[queueId\]/);
  assert.match(actions, /getSingleCreatedAccountItem/);
  assert.match(actions, /item\.status !== "activated"/);
  assert.match(activationActions, /Create account now/);
  assert.match(activationActions, /createFieldActivationAccount/);
  assert.match(activationActions, /Confirm account creation/);
  assert.match(activationActions, /Account created/);
  assert.match(activationActions, /Temporary password/);
  assert.match(activationActions, /Copy credentials/);
  assert.match(activationActions, /Share credentials/);
  assert.doesNotMatch(activationActions, /Blocked for Field/);
  assert.match(activationActions, /navigator\.share/);
  assert.match(activationActions, /AbortError/);
  assert.doesNotMatch(activationActions, /localStorage|sessionStorage|document\.cookie/);
});

test("Create Account stays confirmation-driven and does not persist password", () => {
  const activationActions = read("features/entry/field/FieldActivationActions.tsx");
  const activationPage = read(
    "app/(field)/field/entry/communities/[communityId]/people/activation/[queueId]/page.tsx",
  );

  assert.match(activationActions, /onClick=\{\(\) => setConfirmingAccount\(true\)\}/);
  assert.match(activationActions, /onClick=\{handleCreateAccount\}/);
  assert.doesNotMatch(activationActions, /useEffect/);
  assert.doesNotMatch(activationPage, /temporaryPassword|temporary_password/);
  assert.match(activationActions, /isReadOnlyPreview/);
  assert.match(activationActions, /This activation row is not eligible for account creation/);
  assert.match(activationActions, /Save or share these credentials now/);
});

test("Create Account clears stale activation PIN before invoking account action", () => {
  const activationActions = read("features/entry/field/FieldActivationActions.tsx");
  const handleStart = activationActions.indexOf("function handleCreateAccount()");
  const handleEnd = activationActions.indexOf("async function handleCopy()");
  const handleSource = activationActions.slice(handleStart, handleEnd);

  assert.match(handleSource, /setPinResult\(null\)/);
  assert.match(handleSource, /setCopied\(false\)/);
  assertOccursBefore(handleSource, "setPinResult(null)", "startTransition");
  assertOccursBefore(handleSource, "setCopied(false)", "startTransition");
  assertOccursBefore(
    handleSource,
    "setPinResult(null)",
    "createFieldActivationAccount",
  );
  assert.match(
    activationActions,
    /Creating the account replaces any previously generated activation\s+PIN/,
  );
});

test("Activation PIN remains standalone and shareable only before Create Account starts", () => {
  const activationActions = read("features/entry/field/FieldActivationActions.tsx");

  assert.match(activationActions, /const activationMessage = useMemo/);
  assert.match(activationActions, /if \(!pinResult\?\.pin\)/);
  assert.match(activationActions, /handleGeneratePin/);
  assert.match(activationActions, /generateFieldActivationPin/);
  assert.match(activationActions, /pinResult\?\.pin \?/);
  assert.match(activationActions, /Copy activation message/);
  assert.match(activationActions, /Share activation message/);
});

test("Assignment refreshes resident detail and only targets active units", () => {
  const actions = read("features/entry/field/peopleActions.ts");
  const residentActions = read("features/entry/field/FieldResidentActions.tsx");
  const unitActions = read("features/entry/field/FieldUnitActions.tsx");

  assert.match(
    actions,
    /\/field\/entry\/communities\/\$\{communityId\}\/people\/residents\/\$\{userId\}/,
  );
  assert.match(actions, /!unit\.isActive/);
  assert.match(actions, /This unit is inactive/);
  assert.match(residentActions, /getFieldResidentAssignmentUnits/);
  assert.match(residentActions, /selectedUnit\?\.isActive/);
  assert.match(residentActions, /current, inactive/);
  assert.match(residentActions, /router\.refresh\(\)/);
  assert.match(unitActions, /!unit\.isActive/);
  assert.match(unitActions, /This unit is inactive\. Resident assignment from Field is unavailable/);
  assert.match(unitActions, /router\.refresh\(\)/);
});

test("Resident and unit search helpers filter expected fields", () => {
  const residents = [
    {
      accountState: "Active",
      authType: "email",
      email: "ana@example.com",
      fullName: "Ana Gomez",
      houseId: "u1",
      houseLabel: "Casa 1",
      identity: "ana@example.com",
      isActive: true,
      phone: "555",
      role: "RESIDENT",
      userId: "r1",
      username: "",
    },
    {
      accountState: "Inactive",
      authType: "username",
      email: "resident-luis@entry.internal",
      fullName: "Luis Perez",
      houseId: "",
      houseLabel: "No unit linked",
      identity: "lperez",
      isActive: false,
      phone: "",
      role: "UNASSIGNED",
      userId: "r2",
      username: "lperez",
    },
  ];
  const units = [
    { id: "u1", isActive: true, label: "Casa 1", residentCount: 1 },
    { id: "u2", isActive: true, label: "Torre Norte", residentCount: 0 },
  ];
  const activationRows = [
    {
      email: "",
      id: "q1",
      identityHint: "lperez",
      method: "username_pin",
      phone: "",
      resident: "Luis Perez",
      status: "pending",
      suggestedUsername: "lperez",
      unit: "Torre Norte",
    },
  ];

  assert.deepEqual(filterFieldResidents(residents, "ana").map((item) => item.userId), ["r1"]);
  assert.deepEqual(filterFieldResidents(residents, "unassigned").map((item) => item.userId), ["r2"]);
  assert.deepEqual(filterFieldUnits(units, "norte").map((item) => item.id), ["u2"]);
  assert.deepEqual(filterFieldActivationRows(activationRows, "username").map((item) => item.id), ["q1"]);
});

test("Unit resident count and active assignment helpers preserve dependency state", () => {
  const activeUnit = { id: "u1", isActive: true, label: "Casa 1", residentCount: 0 };
  const inactiveCurrentUnit = {
    id: "u2",
    isActive: false,
    label: "Casa 2",
    residentCount: null,
  };
  const inactiveOtherUnit = {
    id: "u3",
    isActive: false,
    label: "Casa 3",
    residentCount: 0,
  };

  assert.equal(formatFieldUnitResidentCount(activeUnit), "0 linked resident(s)");
  assert.equal(
    formatFieldUnitResidentCount(inactiveCurrentUnit),
    "Resident count unavailable",
  );
  assert.deepEqual(
    getFieldResidentAssignmentUnits(
      [activeUnit, inactiveCurrentUnit, inactiveOtherUnit],
      "u2",
    ).map((unit) => unit.id),
    ["u1", "u2"],
  );
});

test("Reset and activation helper decisions are conservative", () => {
  assert.equal(
    canSendResidentResetEmail({ email: "real@example.com" }),
    true,
  );
  assert.equal(
    canUseResidentRecoveryCode({
      email: "resident-ana@entry.internal",
      role: "RESIDENT",
    }),
    true,
  );
  assert.equal(
    canUseResidentRecoveryCode({
      email: "guard-ana@entry.internal",
      role: "GUARD",
    }),
    false,
  );
  assert.equal(isActivationPinEligible({ status: "pending" }), true);
  assert.equal(isActivationPinEligible({ status: "activated" }), false);
});
