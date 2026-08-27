import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

const registrationFiles = [
  "app/(field)/field/entry/communities/[communityId]/page.tsx",
  "features/entry/field/FieldRegistrationCard.tsx",
];

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
