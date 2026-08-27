import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  createReadyRegistrationProgressState,
  createUnavailableRegistrationProgressState,
  filterRegistrationProgressUnits,
  getRegistrationProgressCounts,
  getRegistrationProgressStatusGroup,
  getRegistrationProgressStatusLabel,
} from "../features/entry/field/registrationProgressStatus.ts";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

const progressFiles = [
  "app/(field)/field/entry/communities/[communityId]/registration/page.tsx",
  "features/entry/field/FieldRegistrationProgressList.tsx",
  "features/entry/field/registrationProgressData.ts",
  "features/entry/field/registrationProgressStatus.ts",
];

test("registration progress route exists under Field and uses authorized server-side registration data", () => {
  const route = read("app/(field)/field/entry/communities/[communityId]/registration/page.tsx");
  const data = read("features/entry/field/registrationProgressData.ts");

  assert.match(route, /getFieldRegistrationProgressState/);
  assert.match(route, /FieldRegistrationProgressList/);
  assert.match(route, /Back to community overview/);
  assert.match(data, /requireSuperadmin/);
  assert.match(data, /createAdminClient/);
});

test("registration progress query selects only safe campaign-unit fields", () => {
  const data = read("features/entry/field/registrationProgressData.ts");

  assert.match(data, /error: campaignsError/);
  assert.match(data, /error: campaignUnitsError/);
  assert.match(data, /\.from\("community_registration_units"\)/);
  assert.match(data, /\.select\("id,unit_label_snapshot,status"\)/);
  assert.match(data, /\.eq\("campaign_id", campaign\.id\)/);
  assert.match(data, /unit_label_snapshot/);
  assert.doesNotMatch(data, /\.from\("houses"\)/);
  assert.doesNotMatch(data, /house_label|owner|ownership/i);
});

test("registration progress does not load PII, residents, submissions, profiles, or members", () => {
  const forbidden =
    /community_registration_residents|community_registration_submissions|profiles|community_members|email|phone|username|fullName|ownerName|houseLabel|submission_payload|answers/i;

  for (const file of progressFiles) {
    assert.doesNotMatch(read(file), forbidden, file);
  }
});

test("registration progress route and components are read-only and Field-only", () => {
  const forbidden =
    /launchCommunityRegistrationCampaign|replaceCommunityRegistrationLink|requestCorrection|enable.*edit|confirm.*Patronato|convertRegistration|activateRegistration|pauseCampaign|closeCampaign|\/products\/entry/i;

  for (const file of progressFiles) {
    assert.doesNotMatch(read(file), forbidden, file);
  }
});

test("registration progress query failures render unavailable instead of false empty states", () => {
  const route = read("app/(field)/field/entry/communities/[communityId]/registration/page.tsx");
  const data = read("features/entry/field/registrationProgressData.ts");
  const unavailableBlock = route.slice(
    route.indexOf('if (progressState.state === "unavailable")'),
    route.indexOf("if (!progressState.campaign)"),
  );

  assert.match(data, /if \(campaignsError\) \{\s*return createUnavailableRegistrationProgressState\(\);/);
  assert.match(data, /if \(campaignUnitsError\) \{\s*return createUnavailableRegistrationProgressState\(\);/);
  assert.match(route, /Resident registration progress unavailable/);
  assert.match(route, /We could not load registration progress right now\./);
  assert.ok(
    route.indexOf('if (progressState.state === "unavailable")') <
      route.indexOf("if (!progressState.campaign)"),
  );
  assert.doesNotMatch(unavailableBlock, /No registration campaign/);
  assert.doesNotMatch(unavailableBlock, /No participating units/);
  assert.doesNotMatch(unavailableBlock, /Aggregate progress|formatFieldCount|0 \/ 0/);
});

test("registration progress state keeps legitimate empty states distinct", () => {
  const unavailable = createUnavailableRegistrationProgressState();
  const noCampaign = createReadyRegistrationProgressState(null, []);
  const emptyCampaign = createReadyRegistrationProgressState(
    {
      id: "campaign-1",
      publicTitle: "Registro de residentes",
      status: "open",
    },
    [],
  );

  assert.deepEqual(unavailable, {
    campaign: null,
    state: "unavailable",
    units: [],
  });
  assert.deepEqual(noCampaign, {
    campaign: null,
    state: "ready",
    units: [],
  });
  assert.deepEqual(emptyCampaign, {
    campaign: {
      id: "campaign-1",
      publicTitle: "Registro de residentes",
      status: "open",
    },
    state: "ready",
    units: [],
  });
});

test("registration progress search filters by unit label", () => {
  const units = [
    { id: "1", label: "Casa 101", status: "unregistered" },
    { id: "2", label: "Torre Norte 8B", status: "submitted" },
    { id: "3", label: "Villa Roble", status: "needs_correction" },
  ];

  assert.deepEqual(
    filterRegistrationProgressUnits({
      filter: "all",
      query: "norte",
      units,
    }).map((unit) => unit.id),
    ["2"],
  );
});

test("registration progress raw statuses map deterministically", () => {
  const expected = [
    ["unregistered", "not_registered", "Not registered"],
    ["submitted", "submitted", "Submitted"],
    ["edit_enabled", "needs_attention", "Edit enabled"],
    ["needs_correction", "needs_attention", "Needs attention"],
    ["reviewed", "reviewed", "Reviewed"],
    ["confirmed", "completed", "Confirmed"],
    ["processed", "completed", "Processed"],
    ["unexpected_state", "other", "unexpected state"],
  ];

  for (const [raw, group, label] of expected) {
    assert.equal(getRegistrationProgressStatusGroup(raw), group);
    assert.equal(getRegistrationProgressStatusLabel(raw), label);
  }
});

test("registration progress filters by status group without dropping unknown statuses from All", () => {
  const units = [
    { id: "1", label: "Casa 1", status: "unregistered" },
    { id: "2", label: "Casa 2", status: "submitted" },
    { id: "3", label: "Casa 3", status: "edit_enabled" },
    { id: "4", label: "Casa 4", status: "needs_correction" },
    { id: "5", label: "Casa 5", status: "reviewed" },
    { id: "6", label: "Casa 6", status: "confirmed" },
    { id: "7", label: "Casa 7", status: "processed" },
    { id: "8", label: "Casa 8", status: "unexpected_state" },
  ];

  assert.deepEqual(
    filterRegistrationProgressUnits({
      filter: "needs_attention",
      query: "",
      units,
    }).map((unit) => unit.id),
    ["3", "4"],
  );
  assert.equal(
    filterRegistrationProgressUnits({ filter: "all", query: "", units }).length,
    8,
  );
});

test("registration progress counts derive submitted, not registered, and attention aggregates", () => {
  const counts = getRegistrationProgressCounts([
    { id: "1", label: "Casa 1", status: "unregistered" },
    { id: "2", label: "Casa 2", status: "submitted" },
    { id: "3", label: "Casa 3", status: "needs_correction" },
    { id: "4", label: "Casa 4", status: "processed" },
  ]);

  assert.deepEqual(counts, {
    needsAttention: 1,
    notRegistered: 1,
    submitted: 3,
    total: 4,
  });
});

test("registration progress handles no campaign state and historical campaign statuses", () => {
  const route = read("app/(field)/field/entry/communities/[communityId]/registration/page.tsx");
  const data = read("features/entry/field/registrationProgressData.ts");

  assert.match(route, /No registration campaign/);
  assert.match(data, /campaigns\[0\] \?\? null/);
  assert.match(route, /Processed/);
  assert.match(route, /Closed/);
});

test("FieldRegistrationCard links to unit progress only when a campaign exists", () => {
  const card = read("features/entry/field/FieldRegistrationCard.tsx");
  const noCampaignBlock = card.slice(
    card.indexOf('if (stateKind === "no_campaign" || !campaign)'),
    card.indexOf('// STATE 2: CAMPAIGN EXISTS BUT IS NOT OPEN'),
  );
  const campaignBlocks = card.slice(
    card.indexOf('// STATE 2: CAMPAIGN EXISTS BUT IS NOT OPEN'),
  );

  assert.match(card, /View unit progress/);
  assert.match(card, /\/field\/entry\/communities\/\$\{encodeURIComponent\(communityId\)\}\/registration/);
  assert.doesNotMatch(noCampaignBlock, /UnitProgressLink/);
  assert.match(campaignBlocks, /UnitProgressLink/);
});

test("existing 001E sharing and 001F launch behavior remain present", () => {
  const card = read("features/entry/field/FieldRegistrationCard.tsx");
  const launchFlow = read("features/entry/field/FieldRegistrationLaunchFlow.tsx");

  assert.match(card, /Copy registration link/);
  assert.match(card, /Share registration link/);
  assert.match(card, /Open registration/);
  assert.match(card, /recoverCommunityRegistrationLink/);
  assert.match(card, /Start registration/);
  assert.match(card, /Start new registration/);
  assert.match(launchFlow, /launchCommunityRegistrationCampaign/);
});
