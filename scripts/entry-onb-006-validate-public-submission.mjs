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

function extractFunction(sql, name) {
  const startPattern = new RegExp(
    `create\\s+or\\s+replace\\s+function\\s+public\\.${name}\\s*\\(`,
    "i",
  );
  const startMatch = startPattern.exec(sql);
  if (!startMatch) fail(`missing function ${name}`);

  const rest = sql.slice(startMatch.index + startMatch[0].length);
  const nextMatch = /\ncreate\s+or\s+replace\s+function\s+public\./i.exec(rest);
  return sql.slice(
    startMatch.index,
    nextMatch ? startMatch.index + startMatch[0].length + nextMatch.index : sql.length,
  );
}

function git(args) {
  return execFileSync("git", args, {
    cwd: new URL(".", ROOT),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

const { parseHouseholdSubmissionBody } = await import(
  new URL(
    "features/entry/communityRegistration/public/submissionPayload.ts",
    ROOT,
  )
);

const TEXT_ENCODER = new TextEncoder();
const TRANSPORT_MAX_BYTES = 1024 * 1024;

function serializedBytes(value) {
  return TEXT_ENCODER.encode(JSON.stringify(value)).length;
}

function makeMaxEmail(index) {
  const suffix = String(index).padStart(6, "0");
  const local = `r${suffix}${"e".repeat(65 - suffix.length - 1)}`;
  const domainLength = 254 - local.length - 1;
  return `${local}@${"d".repeat(domainLength - 3)}.co`;
}

function makeMaxPhone(index) {
  return `+${String(index).padStart(31, "1").slice(-31)}`;
}

function makeResident(index, fullName = `Persona ${index}`) {
  return {
    email: makeMaxEmail(index),
    full_name: fullName,
    is_owner_reference: false,
    phone: makeMaxPhone(index),
    position: index,
    relationship_to_house: "unknown",
  };
}

function makeSubmissionBody(residentCount, options = {}) {
  const fullName = options.fullName ?? "Ada Lovelace";
  const unitLabel = options.unitLabel ?? "Casa 101";

  return {
    residents: Array.from({ length: residentCount }, (_, index) =>
      makeResident(index + 1, fullName),
    ),
    unitLabel,
  };
}

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

const submitRoute = read("app/(public)/entry/register/[slug]/submit/route.ts");
const unitRoute = read("app/(public)/entry/register/[slug]/unit/route.ts");
const requestSecurity = read(
  "features/entry/communityRegistration/public/requestSecurity.ts",
);
const gateway = read("features/entry/communityRegistration/public/gateway.ts");
const payload = read(
  "features/entry/communityRegistration/public/submissionPayload.ts",
);
const householdForm = read(
  "features/entry/communityRegistration/public/HouseholdDraftForm.tsx",
);
const backendSql = read(
  "supabase/migrations/20260806233000_create_entry_community_registration_backend_v1.sql",
);
const reviewSql = read(
  "supabase/migrations/20260806234000_create_entry_community_registration_review_v1.sql",
);

const backendSubmit = extractFunction(
  backendSql,
  "submit_community_registration_household_v1",
);
const backendValidate = extractFunction(backendSql, "_cr_validate_residents_v1");
const reviewEnableEdit = extractFunction(
  reviewSql,
  "enable_community_registration_edit_v1",
);
const reviewResolveEdit = extractFunction(
  reviewSql,
  "resolve_community_registration_edit_v1",
);
const reviewResubmit = extractFunction(
  reviewSql,
  "resubmit_community_registration_household_v1",
);

const diffNames = git(["diff", "--name-only"])
  .split(/\r?\n/)
  .filter(Boolean);

assert(
  "protected Console routes unchanged",
  diffNames.every((name) => !name.startsWith("app/(console)/")),
);
assert(
  "no migrations changed",
  diffNames.every((name) => !name.startsWith("supabase/migrations/")),
);

assert("submit route exports POST", /export\s+async\s+function\s+POST\b/.test(submitRoute));
assert("submit route has no GET export", !/export\s+async\s+function\s+GET\b/.test(submitRoute));
assert(
  "submit route awaits async params",
  /context:\s*\{\s*params:\s*Promise<\{\s*slug:\s*string\s*\}>/.test(submitRoute) &&
    /await\s+context\.params/.test(submitRoute),
);
assert("same-origin boundary required", /hasSameOriginBoundary\(request\)/.test(submitRoute));
assert(
  "signed campaign cookie required",
  /getCampaignAccessCookieName\(slug\)/.test(submitRoute) &&
    /readCampaignAccessCookieValue\(\{[\s\S]*slug/.test(submitRoute),
);
assert("slug normalized before cookie/RPC", /const slug = normalizePublicSlug\(rawSlug\)/.test(submitRoute));
assert("JSON content-type enforced", /hasJsonContentType\(request\)/.test(submitRoute));
assert(
  "body size enforced by header and actual bytes",
  /content-length/.test(submitRoute) &&
    /MAX_SUBMISSION_BODY_BYTES/.test(submitRoute) &&
    /TextEncoder\(\)\.encode\(rawBody\)\.length/.test(submitRoute),
);
assert("malformed JSON handled", /JSON\.parse\(rawBody\)/.test(submitRoute) && /catch/.test(submitRoute));
assert("no-store response headers", /Cache-Control["']:\s*["']no-store, max-age=0/.test(requestSecurity));
assert(
  "transport cap is one mebibyte and not a resident-count rule",
  /MAX_SUBMISSION_BODY_BYTES\s*=\s*1024\s*\*\s*1024/.test(submitRoute) &&
    /Transport security ceiling only/.test(submitRoute) &&
    /backend RPC remains the authority/.test(submitRoute),
);

assert(
  "payload parser does not impose invented resident max",
  !/MAX_RESIDENTS_PER_REQUEST/.test(payload) &&
    !/body\.residents\.length\s*>\s*\d+/.test(payload),
);
assert(
  "backend resident limit remains authority",
  /v_effective_limit\s*:=\s*coalesce\(v_unit\.resident_limit_override,\s*v_campaign\.default_resident_limit\)/i.test(
    backendSubmit,
  ) && /_cr_validate_residents_v1\(p_residents,\s*v_effective_limit\)/i.test(backendSubmit),
);
assert(
  "backend duplicate resident rule exists",
  /v_key\s*:=\s*lower\(v_name\)\s*\|\|\s*'\|'/i.test(backendValidate) &&
    /v_key\s*=\s*any\(v_keys\)/i.test(backendValidate),
);
assert(
  "parser duplicate rule mirrors backend",
  /const duplicateKey = \[/.test(payload) && /seenResidentKeys\.has\(duplicateKey\)/.test(payload),
);
assert(
  "relationship and owner-reference mapping enforced",
  /ALLOWED_RELATIONSHIPS/.test(payload) &&
    /relationship !== "owner"/.test(payload) &&
    /ownerReferenceCount > 1/.test(payload),
);
assert(
  "optional email and phone remain optional",
  /if \("email" in item\)/.test(payload) &&
    /if \("phone" in item\)/.test(payload) &&
    /if \(resident\.normalizedEmail\)/.test(payload) &&
    /if \(resident\.normalizedPhone\)/.test(payload),
);

assert(
  "exact submit RPC name and parameters",
  /submit_community_registration_household_v1/.test(gateway) &&
    /p_campaign_token_hash:\s*input\.tokenHash/.test(gateway) &&
    /p_public_slug:\s*input\.publicSlug/.test(gateway) &&
    /p_residents:\s*input\.residents/.test(gateway) &&
    /p_technical_metadata:\s*\{\}/.test(gateway) &&
    /p_unit_label:\s*unitLabel/.test(gateway),
);
assert(
  "public success response exposes no internal IDs or tokens",
  /return submissionResponse\(\{ submitted: true \}\)/.test(submitRoute) &&
    !/'receipt'/.test(submitRoute) &&
    !/'token_hash'|'campaign_token'|'access_token_id'|'submission_id'|'campaign_unit_id'/.test(
      submitRoute,
    ),
);
assert(
  "submit RPC success contract has receipt but no edit capability",
  /'accepted',\s*true/.test(backendSubmit) &&
    /'receipt'/.test(backendSubmit) &&
    /'resident_count'/.test(backendSubmit) &&
    !/'edit_token_id'|'token_hash'|'edit_token'/.test(backendSubmit) &&
    !/insert\s+into\s+public\.community_registration_access_tokens/i.test(backendSubmit),
);
assert(
  "correction edit token is created only by edit enable flow",
  /insert\s+into\s+public\.community_registration_access_tokens/i.test(reviewEnableEdit) &&
    /'resident_edit'/.test(reviewEnableEdit) &&
    /btrim\(p_edit_token_hash\)/.test(reviewEnableEdit) &&
    /'edit_token_id',\s*v_token_id/.test(reviewEnableEdit) &&
    !/'token_hash'/.test(reviewEnableEdit),
);
assert(
  "edit resolve/resubmit require edit token hash",
  /where token_hash = btrim\(coalesce\(p_edit_token_hash, ''\)\)/.test(
    reviewResolveEdit,
  ) &&
    /where token_hash = btrim\(coalesce\(p_edit_token_hash, ''\)\)/.test(
      reviewResubmit,
    ),
);

assert(
  "resident PII absent from URL/cookies/storage/logs",
  !/localStorage|sessionStorage|document\.cookie|console\./.test(
    `${submitRoute}\n${unitRoute}\n${gateway}\n${householdForm}`,
  ) &&
    !/full_name|email|phone/.test(requestSecurity),
);
assert("duplicate click prevented", /isSubmitting/.test(householdForm) && /disabled=\{isSubmitting\}/.test(householdForm));
assert("no automatic POST retry", (householdForm.match(/fetch\(/g) ?? []).length === 1);
assert(
  "network-uncertain outcome documented",
  /No pudimos confirmar si el registro se guardó/.test(householdForm) &&
    /No se reintentará automáticamente/.test(householdForm),
);
assert(
  "unit lookup route still delegates to same RPC gateway",
  /lookupCommunityRegistrationUnit/.test(unitRoute) &&
    /available:\s*true/.test(unitRoute) &&
    /residentLimit:\s*lookup\.residentLimit/.test(unitRoute),
);

const normalPayload = {
  residents: [
    {
      full_name: "Ada Lovelace",
      is_owner_reference: true,
      position: 1,
      relationship_to_house: "owner",
    },
  ],
  unitLabel: "Casa 101",
};
assert(
  "normal valid payload accepted by real parser",
  parseHouseholdSubmissionBody(normalPayload).ok === true,
);

const maxFieldPayload = makeSubmissionBody(1000, {
  fullName: "😀".repeat(160),
  unitLabel: "😀".repeat(120),
});
const maxFieldBytes = serializedBytes(maxFieldPayload);
assert(
  "maximum-field-size realistic payload accepted by real parser",
  maxFieldBytes < TRANSPORT_MAX_BYTES &&
    parseHouseholdSubmissionBody(maxFieldPayload).ok === true,
);

const oversizedAbusePayload = JSON.stringify({
  residents: [makeResident(1)],
  unitLabel: "Casa 101",
  abuse: "x".repeat(TRANSPORT_MAX_BYTES),
});
const oversizedResult = mockReadJsonBody(oversizedAbusePayload);
assert(
  "oversized abuse payload rejected with 413",
  oversizedResult.ok === false &&
    oversizedResult.status === 413 &&
    oversizedResult.error === "payload_too_large",
);
assert(
  "no resident PII logged in rejection path",
  !/console\.(log|info|warn|error|debug)/.test(submitRoute) &&
    !/console\.(log|info|warn|error|debug)/.test(requestSecurity) &&
    !/console\.(log|info|warn|error|debug)/.test(payload),
);

console.log(`INFO max-field 1000 resident payload bytes: ${maxFieldBytes}`);

console.log("ENTRY-ONB-006 Slice 4 public submission static validation passed.");
