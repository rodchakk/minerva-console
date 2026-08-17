import fs from "node:fs";

const files = {
  actions: "features/entry/communityRegistration/admin/actions.ts",
  card: "features/entry/communityRegistration/admin/CommunityRegistrationCard.tsx",
  page: "app/(console)/products/entry/communities/[communityId]/page.tsx",
  queries: "features/entry/communityRegistration/admin/queries.ts",
  accessState: "features/entry/communityRegistration/public/accessState.ts",
};

function read(path) {
  return fs.readFileSync(path, "utf8");
}

const source = Object.fromEntries(
  Object.entries(files).map(([key, path]) => [key, read(path)]),
);

const checks = [
  [
    "card appears on community detail",
    /<CommunityRegistrationCard/.test(source.page) &&
      /getCommunityRegistrationAdminState\(community\.id\)/.test(source.page),
  ],
  [
    "quick action anchors to resident registration card",
    /href: "#resident-registration"/.test(source.page) &&
      /id="resident-registration"/.test(source.card),
  ],
  [
    "zero-unit campaign cannot be submitted",
    /selectedUnitCount === 0/.test(source.card) &&
      /disabled=\{!canSubmit\}/.test(source.card) &&
      /selectedUnitIds\.length === 0/.test(source.actions),
  ],
  [
    "selected units are passed as house IDs",
    /name="unit_id"/.test(source.card) &&
      /getAll\("unit_id"\)/.test(source.actions) &&
      /p_house_ids: selectedUnitIds/.test(source.actions),
  ],
  [
    "token generated server-side",
    /randomBytes\(32\)\.toString\("base64url"\)/.test(source.actions) &&
      !/randomBytes/.test(source.card),
  ],
  [
    "plaintext token not persisted to storage or logs",
    !/localStorage|sessionStorage|console\.(log|info|warn|error|debug)/.test(
      `${source.actions}\n${source.card}`,
    ),
  ],
  [
    "hash used for backend campaign call",
    /hashRegistrationToken\(plaintextToken\)/.test(source.actions) &&
      /p_campaign_token_hash: campaignTokenHash/.test(source.actions),
  ],
  [
    "public URL uses slug access route",
    /\/entry\/register\/\$\{encodeURIComponent\(\s*returnedSlug,\s*\)\}\/access\?token=\$\{encodeURIComponent\(plaintextToken\)\}/m.test(
      source.actions,
    ),
  ],
  [
    "existing operational campaign prevents conflicting creation UI",
    /hasOperationalCampaign/.test(source.queries) &&
      /status in \('open', 'paused', 'review', 'confirmed'\)/.test(
        read("supabase/migrations/20260806233000_create_entry_community_registration_backend_v1.sql"),
      ) &&
      /!hasOperationalCampaign/.test(source.card),
  ],
  [
    "submitted progress calculation is deterministic",
    /SUBMITTED_COMMUNITY_REGISTRATION_UNIT_STATUSES/.test(source.queries) &&
      /['"]unregistered['"]/.test(
        read("supabase/migrations/20260806232141_create_entry_community_registration_schema_v1.sql"),
      ) &&
      !/SUBMITTED_COMMUNITY_REGISTRATION_UNIT_STATUSES[\s\S]*"unregistered"/.test(
        source.queries,
      ),
  ],
  [
    "no localStorage/sessionStorage token persistence",
    !/localStorage|sessionStorage/.test(`${source.actions}\n${source.card}\n${source.queries}`),
  ],
  [
    "admin UI does not call public route RPCs directly from client",
    !/resolve_community_registration_campaign_v1|lookup_community_registration_unit_v1|submit_community_registration_household_v1/.test(
      source.card,
    ),
  ],
];

let failed = 0;

for (const [name, ok] of checks) {
  if (ok) {
    console.log(`PASS ${name}`);
  } else {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}

if (failed > 0) {
  process.exitCode = 1;
}
