import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

test("Community Registration admin card replaces Submitted states with resident progress", () => {
  const card = read("features/entry/communityRegistration/admin/CommunityRegistrationCard.tsx");
  const page = read("app/(console)/products/entry/communities/[communityId]/page.tsx");

  assert.doesNotMatch(card, /Submitted states/);
  assert.doesNotMatch(card, /submittedStatuses/);
  assert.match(card, /REGISTRATION PROGRESS/);
  assert.match(card, /\{registrationProgress\.percent\}%/);
  assert.match(
    card,
    /\{registrationProgress\.submittedResidents\} of\{" "\}\s*\{registrationProgress\.totalResidents\} residents submitted/,
  );
  assert.match(card, /\{registrationProgress\.remainingResidents\} remaining/);
  assert.match(card, /role="progressbar"/);
  assert.match(card, /aria-valuenow=\{registrationProgress\.percent\}/);
  assert.match(card, /bg-violet-400/);
  assert.match(card, /style=\{\{ width: `\$\{registrationProgress\.percent\}%` \}\}/);
  assert.match(page, /registrationProgress=\{registrationState\.registrationProgress\}/);
});

test("Community Registration admin loader derives resident progress from current submitted residents", () => {
  const query = read("features/entry/communityRegistration/admin/queries.ts");

  assert.match(query, /registrationProgress: CommunityRegistrationAdminProgress/);
  assert.match(query, /createRegistrationProgress\(0, 0\)/);
  assert.match(query, /\.from\("community_registration_units"\)/);
  assert.match(query, /\.select\("id,status,resident_limit_override"\)/);
  assert.match(query, /resident_limit_override/);
  assert.match(query, /campaign\.defaultResidentLimit/);
  assert.match(query, /community_registration_submissions/);
  assert.match(query, /SUBMITTED_COMMUNITY_REGISTRATION_SUBMISSION_STATUSES/);
  assert.match(query, /community_registration_residents/);
  assert.match(query, /\.select\("id", \{ count: "exact", head: true \}\)/);
  assert.match(query, /\.in\("submission_id", currentSubmissionIds\)/);
  assert.match(query, /Math\.min\(\s*100,/);
  assert.match(query, /Math\.max\(normalizedTotal - normalizedSubmitted, 0\)/);
  assert.doesNotMatch(query, /submittedStatuses: readonly string\[\]/);
});
