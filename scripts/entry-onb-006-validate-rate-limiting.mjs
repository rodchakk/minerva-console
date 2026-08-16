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

function indexBefore(source, first, second) {
  const firstIndex = source.indexOf(first);
  const secondIndex = source.indexOf(second);
  return firstIndex >= 0 && secondIndex >= 0 && firstIndex < secondIndex;
}

const packageJson = JSON.parse(read("package.json"));
const packageLock = read("package-lock.json");
const rateLimit = read(
  "features/entry/communityRegistration/public/rateLimit.ts",
);
const accessState = read(
  "features/entry/communityRegistration/public/accessState.ts",
);
const correctionState = read(
  "features/entry/communityRegistration/public/correctionAccessState.ts",
);
const requestSecurity = read(
  "features/entry/communityRegistration/public/requestSecurity.ts",
);
const accessRoute = read("app/(public)/entry/register/[slug]/access/route.ts");
const unitRoute = read("app/(public)/entry/register/[slug]/unit/route.ts");
const submitRoute = read("app/(public)/entry/register/[slug]/submit/route.ts");
const registrationPage = read("app/(public)/entry/register/[slug]/page.tsx");
const correctionAccessRoute = read(
  "app/(public)/entry/register/[slug]/correct/access/route.ts",
);
const correctionSubmitRoute = read(
  "app/(public)/entry/register/[slug]/correct/submit/route.ts",
);
const correctionPage = read(
  "app/(public)/entry/register/[slug]/correct/page.tsx",
);
const unitForm = read(
  "features/entry/communityRegistration/public/UnitLookupForm.tsx",
);
const householdForm = read(
  "features/entry/communityRegistration/public/HouseholdDraftForm.tsx",
);

const diffNames = git(["diff", "--name-only"])
  .split(/\r?\n/)
  .filter(Boolean);

assert(
  "only approved Upstash dependencies added intentionally",
  packageJson.dependencies["@upstash/redis"] &&
    packageJson.dependencies["@upstash/ratelimit"] &&
    !/"@vercel\/firewall"/.test(JSON.stringify(packageJson)) &&
    !/"upstash-ratelimit"/.test(JSON.stringify(packageJson)),
);
assert(
  "package lock contains official Upstash packages",
  /node_modules\/@upstash\/redis/.test(packageLock) &&
    /node_modules\/@upstash\/ratelimit/.test(packageLock),
);
assert(
  "protected Console routes unaffected",
  diffNames.every((name) => !name.startsWith("app/(console)/")),
);
assert(
  "migrations untouched",
  diffNames.every((name) => !name.startsWith("supabase/migrations/")),
);
assert(
  "ENTRY mobile untouched",
  diffNames.every((name) => !/mobile|react-native|expo/i.test(name)),
);

assert(
  "rate limiter module imports official Upstash packages only",
  /from "@upstash\/redis"/.test(rateLimit) &&
    /from "@upstash\/ratelimit"/.test(rateLimit) &&
    !/from "@vercel\/firewall"|from "lru-cache"|from "ioredis"|from "redis"/.test(
      rateLimit,
    ),
);
assert(
  "lazy Upstash initialization at request time",
  /function getRuntimeConfiguration/.test(rateLimit) &&
    /function getRedis/.test(rateLimit) &&
    /new Redis\(\{[\s\S]*UPSTASH_REDIS_REST_URL/.test(rateLimit) === false &&
    /new Redis\(\{[\s\S]*url: input\.redisUrl/.test(rateLimit),
);
assert(
  "missing Preview/Production config fails closed",
  /isVercelRuntime/.test(rateLimit) &&
    /env\.VERCEL === "1"/.test(rateLimit) &&
    /env\.VERCEL_ENV === "preview"/.test(rateLimit) &&
    /env\.VERCEL_ENV === "production"/.test(rateLimit) &&
    /reason: "infrastructure_unavailable"[\s\S]*status: 503/.test(rateLimit),
);
assert(
  "local-development bypass cannot activate on Vercel",
  /return !isVercelRuntime\(env\) && env\.NODE_ENV !== "production"/.test(
    rateLimit,
  ) && /localBypass/.test(rateLimit),
);
assert(
  "analytics protection and ephemeral cache disabled",
  /analytics: false/.test(rateLimit) &&
    /enableProtection: false/.test(rateLimit) &&
    /ephemeralCache: false/.test(rateLimit),
);
assert(
  "sliding window policies configured",
  /Ratelimit\.slidingWindow\(policy\.limit, policy\.window\)/.test(
    rateLimit,
  ),
);
assert(
  "limiter timeout fails closed",
  /timeout: RATE_LIMIT_TIMEOUT_MS/.test(rateLimit) &&
    /result\.reason === "timeout"[\s\S]*infrastructureUnavailable\("redis_timeout"\)/.test(
      rateLimit,
    ),
);
assert(
  "Redis/network exceptions fail closed",
  /catch \(error\) \{[\s\S]*infrastructureUnavailable\(classifyRedisInfrastructureFailure\(error\)\)/.test(
    rateLimit,
  ) &&
    /function infrastructureUnavailable[\s\S]*reason: "infrastructure_unavailable"[\s\S]*status: 503/.test(
      rateLimit,
    ),
);
assert(
  "infrastructure failures emit safe diagnostic categories",
  /entry_cr_rate_limit_failure=\$\{failure\}/.test(rateLimit) &&
    /infrastructureUnavailable\("missing_network_identity"\)/.test(rateLimit) &&
    /infrastructureUnavailable\("missing_runtime_configuration"\)/.test(
      rateLimit,
    ) &&
    /infrastructureUnavailable\("redis_timeout"\)/.test(rateLimit) &&
    /classifyRedisInfrastructureFailure/.test(rateLimit),
);
assert(
  "actual quota denial returns 429 with Retry-After",
  /reason: "rate_limited"[\s\S]*status: 429/.test(rateLimit) &&
    /Retry-After/.test(rateLimit) &&
    /retryAfterSeconds\(result\.reset\)/.test(rateLimit),
);
assert(
  "no-store rate-limit responses",
  /registrationHeaders\(\)/.test(rateLimit) &&
    /Cache-Control["']:\s*["']no-store, max-age=0/.test(requestSecurity),
);

assert(
  "campaign access IP limit implemented",
  /campaignAccessNetwork:\s*\{\s*limit:\s*10,\s*window:\s*"10 m"/.test(
    rateLimit,
  ) && /networkCheck\(source, "campaignAccessNetwork", input\.slug\)/.test(rateLimit),
);
assert(
  "no shared campaign-token global access bucket remains",
  !/campaignAccessToken/.test(rateLimit) &&
    !/campaignTokenCheck/.test(rateLimit) &&
    !/identityParts:\s*\[[\s\S]*"campaign-token"/.test(rateLimit),
);
assert(
  "25+ independent clients sharing a campaign token do not share global token quota",
  /campaignAccessNetwork:\s*\{\s*limit:\s*10,\s*window:\s*"10 m"/.test(
    rateLimit,
  ) &&
    /networkCheck\(source, "campaignAccessNetwork", input\.slug\)/.test(
      rateLimit,
    ) &&
    !/20,\s*window:\s*"10 m"[\s\S]*campaign/.test(rateLimit),
);
assert(
  "each campaign access client remains independently network limited",
  /identityParts:\s*\["network", slug, networkIdentity\]/.test(rateLimit) &&
    /x-forwarded-for/.test(rateLimit),
);
assert(
  "campaign cookie has random per-browser rateLimitSessionId",
  /randomBytes\(32\)\.toString\("base64url"\)/.test(accessState) &&
    /rateLimitSessionId: string/.test(accessState) &&
    /createCampaignRateLimitSessionId/.test(accessRoute),
);
assert(
  "reopening same campaign link preserves matching rateLimitSessionId",
  /const existingAccessState = readCampaignAccessCookieValue/.test(accessRoute) &&
    /existingAccessState\?\.tokenHash === tokenHash/.test(accessRoute) &&
    /existingAccessState\.rateLimitSessionId/.test(accessRoute),
);
assert(
  "new campaign session receives new random rateLimitSessionId",
  /: createCampaignRateLimitSessionId\(\)/.test(accessRoute),
);
assert(
  "tampered or mismatched cookie cannot be reused for rateLimitSessionId",
  /readCampaignAccessCookieValue/.test(accessRoute) &&
    /timingSafeEqual/.test(accessState) &&
    /payload\.slug !== normalizePublicSlug\(input\.slug\)/.test(accessState) &&
    /existingAccessState\?\.tokenHash === tokenHash/.test(accessRoute),
);
assert(
  "campaign cookie remains signed and tamper resistant",
  /createHmac\("sha256"/.test(accessState) &&
    /timingSafeEqual/.test(accessState) &&
    /payload\.slug !== normalizePublicSlug\(input\.slug\)/.test(accessState) &&
    /payload\.rateLimitSessionId/.test(accessState),
);
assert(
  "two campaign browser sessions do not share session bucket",
  /identityParts:\s*\[[\s\S]*"campaign-session"[\s\S]*input\.rateLimitSessionId/.test(
    rateLimit,
  ) && /tokenHash,[\s\S]*input\.rateLimitSessionId/.test(rateLimit),
);
assert(
  "same campaign token can serve independent residents",
  /campaignSessionCheck\("unitLookupSession", input\)/.test(rateLimit) &&
    /campaignSessionCheck\("initialSubmitShort", input\)/.test(rateLimit),
);
assert(
  "unit short-window limit implemented",
  /unitLookupSession:\s*\{\s*limit:\s*8,\s*window:\s*"1 m"/.test(rateLimit),
);
assert(
  "unit long-window network limit implemented",
  /unitLookupNetwork:\s*\{\s*limit:\s*25,\s*window:\s*"15 m"/.test(
    rateLimit,
  ),
);
assert(
  "initial-submit 10-minute limit implemented",
  /initialSubmitShort:\s*\{\s*limit:\s*3,\s*window:\s*"10 m"/.test(
    rateLimit,
  ),
);
assert(
  "initial-submit hourly limit implemented",
  /initialSubmitHourly:\s*\{\s*limit:\s*5,\s*window:\s*"1 h"/.test(
    rateLimit,
  ),
);
assert(
  "correction-access network limit implemented",
  /correctionAccessNetwork:\s*\{\s*limit:\s*6,\s*window:\s*"10 m"/.test(
    rateLimit,
  ),
);
assert(
  "correction-access edit-token limit implemented",
  /correctionAccessToken:\s*\{\s*limit:\s*10,\s*window:\s*"10 m"/.test(
    rateLimit,
  ),
);
assert(
  "correction-submit short limit implemented",
  /correctionSubmitShort:\s*\{\s*limit:\s*3,\s*window:\s*"10 m"/.test(
    rateLimit,
  ),
);
assert(
  "correction-submit hourly limit implemented",
  /correctionSubmitHourly:\s*\{\s*limit:\s*5,\s*window:\s*"1 h"/.test(
    rateLimit,
  ),
);

assert(
  "campaign access is limited before campaign resolution",
  indexBefore(
    accessRoute,
    "enforceCampaignAccessRateLimit",
    "const campaign = await resolveCommunityRegistrationCampaign",
  ),
);
assert(
  "unit lookup is limited before unit label parsing and RPC",
  indexBefore(unitRoute, "enforceUnitLookupRateLimit", "readUnitLabel") &&
    indexBefore(unitRoute, "enforceUnitLookupRateLimit", "const lookup = await lookupCommunityRegistrationUnit"),
);
assert(
  "initial submit is limited before body parsing and RPC",
  indexBefore(submitRoute, "enforceInitialSubmissionRateLimit", "readJsonBody") &&
    indexBefore(submitRoute, "enforceInitialSubmissionRateLimit", "const submission = await submitCommunityRegistrationHousehold"),
);
assert(
  "correction access is limited before edit-token resolution",
  indexBefore(correctionAccessRoute, "enforceCorrectionAccessRateLimit", "const correction = await resolveCommunityRegistrationEdit"),
);
assert(
  "correction submit is limited before re-resolve body parsing and mutation",
  indexBefore(correctionSubmitRoute, "enforceCorrectionSubmissionRateLimit", "const correction = await resolveCommunityRegistrationEdit") &&
    indexBefore(correctionSubmitRoute, "enforceCorrectionSubmissionRateLimit", "readJsonBody") &&
    indexBefore(correctionSubmitRoute, "enforceCorrectionSubmissionRateLimit", "const submission = await resubmitCommunityRegistrationHousehold"),
);
assert(
  "registration page read limiter added because page resolves campaign on render",
  /resolveCommunityRegistrationCampaign/.test(registrationPage) &&
    indexBefore(registrationPage, "enforceCampaignPageReadRateLimit", "const campaign = await resolveCommunityRegistrationCampaign") &&
    /campaignPageRead:\s*\{\s*limit:\s*30,\s*window:\s*"10 m"/.test(rateLimit),
);
assert(
  "correction page read limiter added because page resolves PII on render",
  /resolveCommunityRegistrationEdit/.test(correctionPage) &&
    indexBefore(correctionPage, "enforceCorrectionPageReadRateLimit", "const correction = await resolveCommunityRegistrationEdit") &&
    /correctionPageRead:\s*\{\s*limit:\s*30,\s*window:\s*"10 m"/.test(rateLimit),
);

assert(
  "trusted Vercel client identity uses forwarded source only on Vercel",
  /x-forwarded-for/.test(rateLimit) &&
    /if \(isVercelRuntime\(\)\) \{[\s\S]*return forwardedFor \|\| null/.test(
      rateLimit,
    ) &&
    /x-entry-cr-local-client-id/.test(rateLimit),
);
assert(
  "HMAC key derivation uses separate ENTRY_CR_RATE_LIMIT_SECRET",
  /ENTRY_CR_RATE_LIMIT_SECRET/.test(rateLimit) &&
    /createHmac\("sha256", input\.secret\)/.test(rateLimit) &&
    !/ENTRY_CR_COOKIE_SECRET/.test(rateLimit),
);
assert(
  "Redis keys contain only static prefix environment policy and digest",
  /return `\$\{RATE_LIMIT_PREFIX\}:\$\{input\.environment\}:\$\{input\.policy\}:\$\{digest\}`/.test(
    rateLimit,
  ),
);
assert(
  "HMAC keys contain no raw IP",
  !/prefix:.*networkIdentity|identifier:.*networkIdentity|redis.*networkIdentity/i.test(
    rateLimit,
  ),
);
assert(
  "HMAC keys contain no plaintext tokens",
  !/plaintext|campaign token|edit token/i.test(rateLimit) &&
    !/request\.nextUrl\.searchParams\.get\("token"\)/.test(rateLimit),
);
assert(
  "HMAC keys contain no raw token hashes outside HMAC identity parts",
  /input\.tokenHash/.test(rateLimit) &&
    /input\.editTokenHash/.test(rateLimit) &&
    /deriveRateLimitDigest/.test(rateLimit) &&
    !/return .*tokenHash|return .*editTokenHash/.test(rateLimit),
);
assert(
  "HMAC keys contain no unit label",
  !/unitLabel|unit_label|p_unit_label/.test(rateLimit),
);
assert(
  "HMAC keys contain no resident PII",
  !/fullName|full_name|email|phone|residents|resident name/i.test(rateLimit),
);
assert(
  "different policies generate domain-separated keys",
  /update\(input\.policy\)/.test(rateLimit) &&
    /prefix: `\$\{RATE_LIMIT_PREFIX\}:\$\{input\.environment\}:\$\{input\.policy\}`/.test(
      rateLimit,
    ),
);
assert(
  "different environments generate separate namespaces",
  /getRateLimitEnvironmentNamespace/.test(rateLimit) &&
    /update\(input\.environment\)/.test(rateLimit),
);

assert(
  "exact 429 behavior reaches UI",
  /response\.status === 429/.test(unitForm) &&
    /rate_limited/.test(householdForm) &&
    /Has realizado demasiados intentos/.test(unitForm + householdForm),
);
assert(
  "exact 503 behavior reaches UI",
  /response\.status === 503/.test(unitForm) &&
    /service_unavailable/.test(householdForm) &&
    /No pudimos procesar la solicitud/.test(unitForm + householdForm),
);
assert(
  "existing correction access flow remains valid",
  /createCorrectionAccessCookieValue/.test(correctionAccessRoute) &&
    /readCorrectionAccessCookieValue/.test(correctionPage) &&
    /editTokenHash/.test(correctionState),
);
assert(
  "initial registration validation remains structurally intact",
  /lookupCommunityRegistrationUnit/.test(unitRoute) &&
    /submitCommunityRegistrationHousehold/.test(submitRoute),
);
assert(
  "correction resubmit validation remains structurally intact",
  /resubmitCommunityRegistrationHousehold/.test(correctionSubmitRoute) &&
    /clearCorrectionCookie/.test(correctionSubmitRoute),
);

console.log("ENTRY-ONB-006 Slice 6A rate limiting static validation passed.");
