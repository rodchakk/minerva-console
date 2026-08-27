import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  isRegistrationLaunchEligible,
} from "../features/entry/field/registrationState.ts";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

const launchFlowFiles = [
  "app/(field)/field/entry/communities/[communityId]/registration/start/page.tsx",
  "features/entry/field/FieldRegistrationLaunchFlow.tsx",
  "features/entry/field/FieldRegistrationCard.tsx",
];

test("isRegistrationLaunchEligible enforces exact launch eligibility rules", () => {
  // 1. No campaign + units + production => eligible
  assert.equal(
    isRegistrationLaunchEligible({
      hasOperationalCampaign: false,
      isReadOnlyPreview: false,
      unitCount: 10,
    }),
    true,
  );

  // 2. Historical closed/processed campaign (hasOperationalCampaign: false) + units => eligible
  assert.equal(
    isRegistrationLaunchEligible({
      hasOperationalCampaign: false,
      isReadOnlyPreview: false,
      unitCount: 5,
    }),
    true,
  );

  // 3. Operational campaign (open, paused, review, confirmed) => ineligible
  assert.equal(
    isRegistrationLaunchEligible({
      hasOperationalCampaign: true,
      isReadOnlyPreview: false,
      unitCount: 10,
    }),
    false,
  );

  // 4. Zero units => ineligible
  assert.equal(
    isRegistrationLaunchEligible({
      hasOperationalCampaign: false,
      isReadOnlyPreview: false,
      unitCount: 0,
    }),
    false,
  );

  // 5. Preview read-only => ineligible
  assert.equal(
    isRegistrationLaunchEligible({
      hasOperationalCampaign: false,
      isReadOnlyPreview: true,
      unitCount: 10,
    }),
    false,
  );
});

test("Field launch flow component selects all units by default and requires at least one selected unit", () => {
  const flow = read("features/entry/field/FieldRegistrationLaunchFlow.tsx");

  assert.match(flow, /new Set\(units\.map\(\(u\) => u\.id\)\)/);
  assert.match(flow, /selectedUnitCount > 0/);
  assert.match(flow, /Select at least one unit/);
});

test("Configure to Confirm transition in launch flow DOES NOT invoke launch action", () => {
  const flow = read("features/entry/field/FieldRegistrationLaunchFlow.tsx");

  // Step 1 button only updates step state to "confirm"
  assert.match(flow, /onClick=\{\(\) => setStep\("confirm"\)\}/);
  // launchCommunityRegistrationCampaign is called inside handleStartCampaign in Step 2
  assert.match(flow, /handleStartCampaign/);
  assert.match(flow, /launchCommunityRegistrationCampaign/);
});

test("Field launch flow imports launch action but DOES NOT import replace action", () => {
  for (const file of launchFlowFiles) {
    const source = read(file);

    assert.doesNotMatch(source, /replaceCommunityRegistrationLink/, file);
  }

  const flow = read("features/entry/field/FieldRegistrationLaunchFlow.tsx");
  assert.match(flow, /launchCommunityRegistrationCampaign/);
});

test("Field launch flow does not persist token or registration URL in storage or query params", () => {
  for (const file of launchFlowFiles) {
    const source = read(file);

    assert.doesNotMatch(source, /localStorage|sessionStorage/i, file);
    assert.doesNotMatch(source, /https?:\/\/[^\s"]+\/entry\/register/i, file);
    assert.doesNotMatch(source, /token=/i, file);
  }
});

test("Field launch flow does not link to desktop /products/entry management routes", () => {
  for (const file of launchFlowFiles) {
    const source = read(file);

    assert.doesNotMatch(source, /\/products\/entry/, file);
  }
});

test("Field launch flow does not render personal registration data or user attributes", () => {
  for (const file of launchFlowFiles) {
    const source = read(file);

    assert.doesNotMatch(
      source,
      /email|phone|username|fullName|ownerName|houseLabel|contact/i,
      file,
    );
  }
});
