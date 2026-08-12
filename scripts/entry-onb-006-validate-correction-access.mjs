import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function assert(name, condition) {
  if (!condition) {
    console.error(`FAIL ${name}`);
    process.exitCode = 1;
    return;
  }

  console.log(`PASS ${name}`);
}

const correctionState = read(
  "features/entry/communityRegistration/public/correctionAccessState.ts",
);
const gateway = read("features/entry/communityRegistration/public/gateway.ts");
const accessRoute = read(
  "app/(public)/entry/register/[slug]/correct/access/route.ts",
);
const correctionPage = read(
  "app/(public)/entry/register/[slug]/correct/page.tsx",
);
const form = read(
  "features/entry/communityRegistration/public/HouseholdDraftForm.tsx",
);
const registrationPage = read("app/(public)/entry/register/[slug]/page.tsx");
const unitRoute = read("app/(public)/entry/register/[slug]/unit/route.ts");
const submitRoute = read("app/(public)/entry/register/[slug]/submit/route.ts");

assert(
  "separate correction cookie namespace",
  /entry_cr_correction_/.test(correctionState) &&
    !/getCampaignAccessCookieName/.test(accessRoute) &&
    !/readCampaignAccessCookieValue/.test(correctionPage),
);

assert(
  "correction cookie is signed and slug-bound",
  /createHmac\("sha256"/.test(correctionState) &&
    /timingSafeEqual/.test(correctionState) &&
    /payload\.slug !== normalizePublicSlug\(input\.slug\)/.test(correctionState),
);

assert(
  "correction cookie contains hash only, no plaintext token or PII fields",
  /type CorrectionAccessPayload = \{\s*editTokenHash: string;\s*expiresAt: string;\s*issuedAt: number;\s*slug: string;\s*v: 1;\s*\}/.test(
    correctionState,
  ) &&
    /const payload: CorrectionAccessPayload = \{\s*editTokenHash: input\.editTokenHash,\s*expiresAt: input\.expiresAt,\s*issuedAt: Date\.now\(\),\s*slug: normalizePublicSlug\(input\.slug\),\s*v: 1,\s*\}/.test(
      correctionState,
    ) &&
    !/fullName|full_name|email|phone|resident/i.test(correctionState),
);

assert(
  "cookie lifetime bounded by edit-token expiry",
  /getCorrectionAccessMaxAgeSeconds\(expiresAt: string\)/.test(correctionState) &&
    /Date\.parse\(expiresAt\)/.test(correctionState) &&
    /Math\.min\(remainingSeconds, CORRECTION_ACCESS_SESSION_MAX_AGE_SECONDS\)/.test(
      correctionState,
    ) &&
    /maxAge/.test(accessRoute),
);

assert(
  "access route hashes plaintext before gateway and redirects clean",
  /hashCorrectionToken\(token\)/.test(accessRoute) &&
    /resolveCommunityRegistrationEdit\(\{ editTokenHash \}\)/.test(accessRoute) &&
    /status: 303/.test(accessRoute) &&
    /cleanCorrectionUrl/.test(accessRoute),
);

assert(
  "access route requires resolved public_slug to match route slug",
  /normalizePublicSlug\(correction\.publicSlug\) !== slug/.test(accessRoute),
);

assert(
  "invalid access fails closed and clears correction cookie",
  /redirectWithoutCorrectionAccess/.test(accessRoute) &&
    /clearCorrectionAccessCookieOptions/.test(accessRoute) &&
    /maxAge: 0/.test(correctionState) &&
    /UnavailableCorrectionState/.test(correctionPage),
);

assert(
  "correction page re-resolves on every render",
  /readCorrectionAccessCookieValue/.test(correctionPage) &&
    /resolveCommunityRegistrationEdit\(\{\s*editTokenHash: correctionState\.editTokenHash/.test(
      correctionPage,
    ) &&
    /force-no-store/.test(correctionPage),
);

assert(
  "resolve-edit gateway calls only resolve RPC and exposes public model",
  /resolve_community_registration_edit_v1/.test(gateway) &&
    /p_edit_token_hash: input\.editTokenHash/.test(gateway) &&
    /effectiveResidentLimit/.test(gateway) &&
    /relationshipToHouse/.test(gateway) &&
    !/edit_token_id|campaign_unit_id|submission_id/.test(
      gateway.slice(gateway.indexOf("export async function resolveCommunityRegistrationEdit")),
    ),
);

assert(
  "prefilled residents feed reusable household draft form",
  /initialResidents/.test(form) &&
    /createResidentDraftFromInitial/.test(form) &&
    /finalAction="correction-submit"/.test(correctionPage),
);

assert(
  "dynamic resident limit comes from resolve edit",
  /residentLimit=\{correction\.effectiveResidentLimit\}/.test(correctionPage) &&
    /residents\.length >= residentLimit/.test(form),
);

assert(
  "owner-reference rules preserved",
  /resident\.relationship !== "owner"/.test(form) &&
    /Solo puede haber un propietario de referencia/.test(form),
);

assert(
  "correction page delegates submission and does not call resubmit RPC directly",
  /Enviar cambios/.test(form) &&
    !/resubmit_community_registration_household_v1/.test(correctionPage) &&
    !/resubmit_community_registration_household_v1/.test(form),
);

assert(
  "PII not stored in URL/cookies/storage/logs by correction implementation",
  !/localStorage|sessionStorage|console\.(log|warn|error)|analytics/.test(
    correctionPage + accessRoute + correctionState,
  ) &&
    !/fullName|email|phone|residents/.test(correctionState),
);

assert(
  "original registration route family remains present",
  /getCampaignAccessCookieName/.test(registrationPage) &&
    /lookupCommunityRegistrationUnit/.test(unitRoute) &&
    /submitCommunityRegistrationHousehold/.test(submitRoute),
);

if (process.exitCode) {
  process.exit(process.exitCode);
}
