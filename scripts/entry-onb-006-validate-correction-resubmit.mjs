import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const ROOT = new URL("../", import.meta.url);

function read(path) {
  return readFileSync(new URL(path, ROOT), "utf8");
}

function fail(message) {
  throw new Error(message);
}

function assert(name, condition) {
  if (!condition) fail(name);
  console.log(`PASS ${name}`);
}

function git(args) {
  return execFileSync("git", args, {
    cwd: new URL(".", ROOT),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

const {
  buildHouseholdSubmissionResidents,
  parseHouseholdCorrectionSubmissionBody,
  parseHouseholdSubmissionBody,
} = await import(
  new URL(
    "features/entry/communityRegistration/public/submissionPayload.ts",
    ROOT,
  )
);

const TEXT_ENCODER = new TextEncoder();
const TRANSPORT_MAX_BYTES = 1024 * 1024;

function mockReadJsonBody(rawBody, contentLength = null) {
  if (contentLength !== null && contentLength > TRANSPORT_MAX_BYTES) {
    return { error: "payload_too_large", ok: false, status: 413 };
  }

  if (TEXT_ENCODER.encode(rawBody).length > TRANSPORT_MAX_BYTES) {
    return { error: "payload_too_large", ok: false, status: 413 };
  }

  try {
    return { body: JSON.parse(rawBody), ok: true, status: 200 };
  } catch {
    return { error: "invalid_request", ok: false, status: 400 };
  }
}

function makeResident(index, overrides = {}) {
  return {
    full_name: `Entry Resident ${index}`,
    is_owner_reference: false,
    position: index,
    relationship_to_house: "family",
    ...overrides,
  };
}

const correctionSubmitRoute = read(
  "app/(public)/entry/register/[slug]/correct/submit/route.ts",
);
const correctionAccessRoute = read(
  "app/(public)/entry/register/[slug]/correct/access/route.ts",
);
const correctionPage = read(
  "app/(public)/entry/register/[slug]/correct/page.tsx",
);
const initialSubmitRoute = read(
  "app/(public)/entry/register/[slug]/submit/route.ts",
);
const registrationPage = read("app/(public)/entry/register/[slug]/page.tsx");
const unitRoute = read("app/(public)/entry/register/[slug]/unit/route.ts");
const requestSecurity = read(
  "features/entry/communityRegistration/public/requestSecurity.ts",
);
const correctionState = read(
  "features/entry/communityRegistration/public/correctionAccessState.ts",
);
const gateway = read("features/entry/communityRegistration/public/gateway.ts");
const payload = read(
  "features/entry/communityRegistration/public/submissionPayload.ts",
);
const householdForm = read(
  "features/entry/communityRegistration/public/HouseholdDraftForm.tsx",
);

const diffNames = git(["diff", "--name-only"])
  .split(/\r?\n/)
  .filter(Boolean);

assert(
  "protected Console routes unchanged",
  diffNames.every((name) => !name.startsWith("app/(console)/")),
);
assert(
  "migrations unchanged",
  diffNames.every((name) => !name.startsWith("supabase/migrations/")),
);
assert(
  "ENTRY mobile untouched",
  diffNames.every((name) => !/mobile|react-native|expo/i.test(name)),
);

assert(
  "correction submit route is POST-only",
  /export\s+async\s+function\s+POST\b/.test(correctionSubmitRoute) &&
    !/export\s+async\s+function\s+GET\b/.test(correctionSubmitRoute),
);
assert(
  "correction route awaits async params",
  /context:\s*\{\s*params:\s*Promise<\{\s*slug:\s*string\s*\}>/.test(
    correctionSubmitRoute,
  ) && /await\s+context\.params/.test(correctionSubmitRoute),
);
assert(
  "correction route requires same-origin and JSON",
  /hasSameOriginBoundary\(request\)/.test(correctionSubmitRoute) &&
    /hasJsonContentType\(request\)/.test(correctionSubmitRoute),
);
assert(
  "correction route uses signed correction cookie only",
  /getCorrectionAccessCookieName\(slug\)/.test(correctionSubmitRoute) &&
    /readCorrectionAccessCookieValue\(\{[\s\S]*slug/.test(
      correctionSubmitRoute,
    ) &&
    !/getCampaignAccessCookieName|readCampaignAccessCookieValue/.test(
      correctionSubmitRoute,
    ),
);
assert(
  "correction route enforces slug binding through re-resolve",
  /resolveCommunityRegistrationEdit\(\{[\s\S]*editTokenHash: correctionState\.editTokenHash/.test(
    correctionSubmitRoute,
  ) &&
    /normalizePublicSlug\(correction\.publicSlug\) !== slug/.test(
      correctionSubmitRoute,
    ),
);
assert(
  "correction route re-resolves before mutation",
  correctionSubmitRoute.indexOf("resolveCommunityRegistrationEdit") <
    correctionSubmitRoute.indexOf("resubmitCommunityRegistrationHousehold"),
);
assert(
  "transport body-size ceiling consistent with Slice 4",
  /MAX_SUBMISSION_BODY_BYTES\s*=\s*1024\s*\*\s*1024/.test(
    correctionSubmitRoute,
  ) &&
    /Transport security ceiling only/.test(correctionSubmitRoute) &&
    /content-length/.test(correctionSubmitRoute) &&
    /TextEncoder\(\)\.encode\(rawBody\)\.length/.test(correctionSubmitRoute),
);
assert(
  "no-store correction responses",
  /jsonRegistrationResponse/.test(correctionSubmitRoute) &&
    /Cache-Control["']:\s*["']no-store, max-age=0/.test(requestSecurity),
);

assert(
  "gateway maps exact resubmit RPC parameters",
  /resubmit_community_registration_household_v1/.test(gateway) &&
    /p_edit_token_hash:\s*input\.editTokenHash/.test(gateway) &&
    /p_residents:\s*input\.residents/.test(gateway) &&
    !/p_public_slug|p_campaign_token_hash|p_unit_label/.test(
      gateway.slice(gateway.indexOf("export async function resubmitCommunityRegistrationHousehold")),
    ),
);
assert(
  "public success response exposes only submitted true",
  /correctionSubmissionResponse\(\{ submitted: true \}\)/.test(
    correctionSubmitRoute,
  ) &&
    !/receipt|version|submission_id|campaign_unit_id|edit_token_id|token_hash/.test(
      correctionSubmitRoute,
    ),
);
assert(
  "success and invalid access clear correction cookie",
  /clearCorrectionAccessCookieOptions/.test(correctionSubmitRoute) &&
    /maxAge:\s*0/.test(correctionState) &&
    /if \(submission\.submitted\)[\s\S]*clearCorrectionCookie/.test(
      correctionSubmitRoute,
    ) &&
    /correctionAccessUnavailable\(slug\)/.test(correctionSubmitRoute),
);
assert(
  "unexpected failures preserve cookie for uncertain outcome",
  /return correctionSubmissionResponse\(\s*\{\s*error: "try_again"/.test(
    correctionSubmitRoute,
  ) &&
    !/clearCorrectionCookie\(\s*correctionSubmissionResponse\(\s*\{\s*error: "try_again"/.test(
      correctionSubmitRoute,
    ),
);

assert(
  "correction UI enables explicit Enviar cambios",
  /finalAction="correction-submit"/.test(correctionPage) &&
    /"Enviar cambios"/.test(householdForm) &&
    /"Enviando cambios\.\.\."/.test(householdForm),
);
assert(
  "duplicate click prevented and no automatic retry",
  /if \(isSubmitting \|\| reviewResidents\.length < MIN_RESIDENTS\) return/.test(
    householdForm,
  ) &&
    /disabled=\{finalAction === "local-review" \|\| isSubmitting\}/.test(
      householdForm,
    ) &&
    (householdForm.match(/fetch\(/g) ?? []).length === 1,
);
assert(
  "ambiguous correction outcome has safe UX",
  /No pudimos confirmar si los cambios se guardaron/.test(householdForm) &&
    /No se reintentará automáticamente/.test(householdForm) &&
    /abre de nuevo el enlace oficial/.test(householdForm),
);
assert(
  "neutral correction access error mapping",
  /Este enlace de corrección ya no está disponible/.test(householdForm) &&
    !/ENTRY_CR_|P0409|42501/.test(householdForm + correctionSubmitRoute),
);

assert(
  "valid correction draft maps exactly to RPC resident payload",
  (() => {
    const mapped = buildHouseholdSubmissionResidents([
      {
        isOwnerReference: true,
        normalizedEmail: "owner@example.com",
        normalizedFullName: "Owner Person",
        normalizedPhone: "+50255550101",
        position: 1,
        relationship: "owner",
      },
      {
        isOwnerReference: false,
        normalizedEmail: "",
        normalizedFullName: "Family Person",
        normalizedPhone: "",
        position: 2,
        relationship: "family",
      },
    ]);

    return (
      mapped.length === 2 &&
      mapped[0].full_name === "Owner Person" &&
      mapped[0].email === "owner@example.com" &&
      mapped[0].phone === "+50255550101" &&
      mapped[0].position === 1 &&
      mapped[0].relationship_to_house === "owner" &&
      mapped[0].is_owner_reference === true &&
      mapped[1].full_name === "Family Person" &&
      !("email" in mapped[1]) &&
      !("phone" in mapped[1]) &&
      mapped[1].position === 2 &&
      mapped[1].relationship_to_house === "family" &&
      mapped[1].is_owner_reference === false
    );
  })(),
);
assert(
  "correction parser accepts residents-only payload",
  parseHouseholdCorrectionSubmissionBody({
    residents: [makeResident(1, { relationship_to_house: "owner", is_owner_reference: true })],
  }).ok === true,
);
assert(
  "correction parser rejects unitLabel and unrelated keys",
  parseHouseholdCorrectionSubmissionBody({
    residents: [makeResident(1)],
    unitLabel: "Casa 101",
  }).ok === false,
);
assert(
  "initial submission parser remains unit-label scoped",
  parseHouseholdSubmissionBody({
    residents: [makeResident(1)],
  }).ok === false &&
    parseHouseholdSubmissionBody({
      residents: [makeResident(1)],
      unitLabel: "Casa 101",
    }).ok === true,
);
assert(
  "malformed JSON and oversized abuse payload fail closed",
  mockReadJsonBody("{").ok === false &&
    mockReadJsonBody(JSON.stringify({ residents: [makeResident(1)] }), TRANSPORT_MAX_BYTES + 1)
      .status === 413,
);
assert(
  "dynamic resident and owner-reference rules preserved",
  /parsedBody\.body\.residents\.length > correction\.effectiveResidentLimit/.test(
    correctionSubmitRoute,
  ) &&
    /resident\.relationship !== "owner"/.test(householdForm) &&
    /ownerReferenceCount > 1/.test(payload),
);

assert(
  "plaintext token never reaches resubmit route",
  !/hashCorrectionToken|searchParams|get\("token"\)|p_edit_token/.test(
    correctionSubmitRoute,
  ) &&
    /editTokenHash: correctionState\.editTokenHash/.test(correctionSubmitRoute),
);
assert(
  "no internal IDs token hashes or service-role returned",
  !/submission_id|campaign_id|campaign_unit_id|edit_token_id|token_hash|service_role/.test(
    correctionSubmitRoute,
  ) &&
    !/submissionId|campaignId|campaignUnitId|editTokenId|tokenHash/.test(
      householdForm,
    ),
);
assert(
  "resident PII absent from URL cookies storage logs analytics",
  !/localStorage|sessionStorage|document\.cookie|console\.(log|info|warn|error|debug)|analytics/.test(
    [
      correctionSubmitRoute,
      correctionAccessRoute,
      correctionPage,
      correctionState,
      gateway,
      householdForm,
    ].join("\n"),
  ) && !/fullName|full_name|email|phone|residents/.test(correctionState),
);
assert(
  "Slice 5A resolve/prefill remains server-side",
  /force-no-store/.test(correctionPage) &&
    /resolveCommunityRegistrationEdit\(\{[\s\S]*editTokenHash: correctionState\.editTokenHash/.test(
      correctionPage,
    ) &&
    /initialResidents=\{correction\.residents\.map/.test(correctionPage),
);
assert(
  "original registration flow remains unaffected",
  /getCampaignAccessCookieName/.test(registrationPage) &&
    /lookupCommunityRegistrationUnit/.test(unitRoute) &&
    /submitCommunityRegistrationHousehold/.test(initialSubmitRoute),
);

console.log("ENTRY-ONB-006 Slice 5B correction resubmit static validation passed.");
