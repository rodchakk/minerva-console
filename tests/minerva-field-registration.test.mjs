import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  getFieldRegistrationStateKind,
} from "../features/entry/field/registrationState.ts";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

const registrationFiles = [
  "app/(field)/field/entry/communities/[communityId]/page.tsx",
  "features/entry/field/FieldRegistrationCard.tsx",
  "features/entry/field/registrationState.ts",
];

test("getFieldRegistrationStateKind classifies state correctly without treating historical non-operational campaigns as Not started", () => {
  // 1. Null campaign -> no_campaign (Not started)
  assert.equal(getFieldRegistrationStateKind(null), "no_campaign");

  // 2. Historical processed campaign with hasOperationalCampaign: false -> non_open_campaign (NOT no_campaign)
  const processedCampaign = {
    activeCampaignAccessRecoverable: false,
    defaultResidentLimit: 3,
    id: "camp-processed",
    publicSlug: "slug-processed",
    publicTitle: "Registro de residentes 2025",
    status: "processed",
  };
  assert.equal(getFieldRegistrationStateKind(processedCampaign), "non_open_campaign");

  // 3. Historical closed campaign -> non_open_campaign
  const closedCampaign = {
    activeCampaignAccessRecoverable: false,
    defaultResidentLimit: 3,
    id: "camp-closed",
    publicSlug: "slug-closed",
    publicTitle: "Registro de residentes 2024",
    status: "closed",
  };
  assert.equal(getFieldRegistrationStateKind(closedCampaign), "non_open_campaign");

  // 4. Paused campaign -> non_open_campaign
  const pausedCampaign = {
    activeCampaignAccessRecoverable: true,
    defaultResidentLimit: 3,
    id: "camp-paused",
    publicSlug: "slug-paused",
    publicTitle: "Registro de residentes 2026",
    status: "paused",
  };
  assert.equal(getFieldRegistrationStateKind(pausedCampaign), "non_open_campaign");

  // 5. Open unrecoverable campaign -> open_unrecoverable
  const openUnrecoverable = {
    activeCampaignAccessRecoverable: false,
    defaultResidentLimit: 3,
    id: "camp-open-legacy",
    publicSlug: "slug-open-legacy",
    publicTitle: "Registro de residentes",
    status: "open",
  };
  assert.equal(getFieldRegistrationStateKind(openUnrecoverable), "open_unrecoverable");

  // 6. Open recoverable campaign -> open_recoverable
  const openRecoverable = {
    activeCampaignAccessRecoverable: true,
    defaultResidentLimit: 3,
    id: "camp-open",
    publicSlug: "slug-open",
    publicTitle: "Registro de residentes",
    status: "open",
  };
  assert.equal(getFieldRegistrationStateKind(openRecoverable), "open_recoverable");
});

test("FieldRegistrationCard source does not use hasOperationalCampaign to classify Not started state", () => {
  const card = read("features/entry/field/FieldRegistrationCard.tsx");

  assert.doesNotMatch(card, /!campaign\s*\|\|\s*!hasOperationalCampaign/);
});

test("Field community detail uses getCommunityRegistrationAdminState for server-side state loading", () => {
  const detail = read("app/(field)/field/entry/communities/[communityId]/page.tsx");

  assert.match(detail, /getCommunityRegistrationAdminState/);
  assert.match(detail, /FieldRegistrationCard/);
});

test("Field registration card uses recoverCommunityRegistrationLink action", () => {
  const card = read("features/entry/field/FieldRegistrationCard.tsx");

  assert.match(card, /recoverCommunityRegistrationLink/);
});

test("Field registration components DO NOT import campaign launch or link replacement actions", () => {
  for (const file of registrationFiles) {
    const source = read(file);

    assert.doesNotMatch(source, /launchCommunityRegistrationCampaign/, file);
    assert.doesNotMatch(source, /replaceCommunityRegistrationLink/, file);
  }
});

test("Field registration components DO NOT link to desktop /products/entry management routes", () => {
  for (const file of registrationFiles) {
    const source = read(file);

    assert.doesNotMatch(source, /\/products\/entry/, file);
  }
});

test("Plaintext registration URL or token is NOT embedded in initial page markup or defaults", () => {
  for (const file of registrationFiles) {
    const source = read(file);

    assert.doesNotMatch(source, /https?:\/\/[^\s"]+\/entry\/register/i, file);
    assert.doesNotMatch(source, /token=[a-zA-Z0-9_-]{10,}/i, file);
  }
});

test("Field registration card provides Copy, Share (feature detected), and Open actions for open recoverable state", () => {
  const card = read("features/entry/field/FieldRegistrationCard.tsx");

  assert.match(card, /Copy registration link/);
  assert.match(card, /navigator\.share/);
  assert.match(card, /Open registration/);
  assert.match(card, /navigator\.clipboard\.writeText/);
});

test("Field registration card does not expose action buttons for non-open campaigns or unrecoverable links", () => {
  const card = read("features/entry/field/FieldRegistrationCard.tsx");

  assert.match(card, /Registration link sharing is available only while the campaign is open/);
  assert.match(card, /The current registration link cannot be recovered from Field/);
  assert.doesNotMatch(card, /Replace registration link/);
});

test("Field registration card does not render personal registration data or user attributes", () => {
  for (const file of registrationFiles) {
    const source = read(file);

    assert.doesNotMatch(
      source,
      /email|phone|username|fullName|ownerName|houseLabel|contact/i,
      file,
    );
  }
});
