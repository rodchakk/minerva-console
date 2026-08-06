import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

const migrationName =
  "20260805000300_create_entry_community_registration_review_v1.sql";
const migrationPath = resolve("supabase/migrations", migrationName);
const schemaV1Path = resolve(
  "supabase/migrations/20260805000100_create_entry_community_registration_schema_v1.sql",
);
const backendV1Path = resolve(
  "supabase/migrations/20260805000200_create_entry_community_registration_backend_v1.sql",
);

const sql = readFileSync(migrationPath, "utf8");
const schemaV1 = readFileSync(schemaV1Path, "utf8");
const backendV1 = readFileSync(backendV1Path, "utf8");
const schemaV1Head = execFileSync("git", [
  "show",
  "HEAD:supabase/migrations/20260805000100_create_entry_community_registration_schema_v1.sql",
], { encoding: "utf8" });
const backendV1Head = execFileSync("git", [
  "show",
  "HEAD:supabase/migrations/20260805000200_create_entry_community_registration_backend_v1.sql",
], { encoding: "utf8" });

const failures = [];
const normalized = sql.replace(/\s+/g, " ").toLowerCase();
const legacyInviteTable = `resident_${"invites"}`;
const legacyCodeTable = `account_${"activation"}_${"codes"}`;
const legacyActivateByCode = `activate-account-${"by-code"}`;
const legacyClaimInvite = `claim-resident-${"invite"}`;

function fail(message) {
  failures.push(message);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeSql(value) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

if (!readdirSync(resolve("supabase/migrations")).includes(migrationName)) {
  fail("Missing ENTRY-ONB-003 review migration");
}

if (schemaV1.replace(/\r\n/g, "\n") !== schemaV1Head.replace(/\r\n/g, "\n")) {
  fail("ENTRY-ONB-001 migration changed relative to HEAD");
}

if (backendV1.replace(/\r\n/g, "\n") !== backendV1Head.replace(/\r\n/g, "\n")) {
  fail("ENTRY-ONB-002 migration changed relative to HEAD");
}

const requiredFunctions = [
  {
    name: "create_community_registration_patronato_access_v1",
    args: "uuid, text, timestamptz, uuid",
    internalActor: true,
  },
  {
    name: "revoke_community_registration_patronato_access_v1",
    args: "uuid, uuid, text",
    internalActor: true,
  },
  {
    name: "resolve_community_registration_patronato_access_v1",
    args: "text",
  },
  {
    name: "start_community_registration_review_v1",
    args: "uuid, uuid",
    internalActor: true,
  },
  {
    name: "get_community_registration_review_summary_v1",
    args: "uuid, text",
  },
  {
    name: "list_community_registration_review_units_v1",
    args: "uuid, text, text, text, integer, integer",
  },
  {
    name: "get_community_registration_review_unit_v1",
    args: "uuid, uuid, text",
  },
  {
    name: "mark_community_registration_unit_reviewed_v1",
    args: "uuid, uuid",
    internalActor: true,
  },
  {
    name: "request_community_registration_correction_v1",
    args: "uuid, uuid, text, uuid, text",
  },
  {
    name: "confirm_community_registration_unit_v1",
    args: "uuid, uuid, text",
  },
  {
    name: "authorize_incomplete_campaign_confirmation_v1",
    args: "uuid, uuid, text",
    internalActor: true,
  },
  {
    name: "confirm_community_registration_campaign_v1",
    args: "uuid, text",
  },
];

const replacedFunctions = [
  {
    name: "enable_community_registration_edit_v1",
    args: "uuid, text, timestamptz, uuid, text",
  },
  {
    name: "resolve_community_registration_edit_v1",
    args: "text",
  },
  {
    name: "resubmit_community_registration_household_v1",
    args: "text, jsonb",
  },
  {
    name: "reset_community_registration_unit_v1",
    args: "uuid, uuid, text",
  },
];

const helperFunctions = [
  "_cr_validate_observation_v1",
  "_cr_replace_current_review_v1",
  "_cr_patronato_token_v1",
];

const functionMatches = [
  ...sql.matchAll(
    /create or replace function public\.([a-z0-9_]+)\s*\(([\s\S]*?)\)\s*returns\s+([a-z0-9_."% \[\]]+)\s+language\s+([a-z]+)([\s\S]*?)as\s+\$function\$([\s\S]*?)\$function\$;/gi,
  ),
];

const functions = new Map();
for (const match of functionMatches) {
  functions.set(match[1], {
    name: match[1],
    params: normalizeSql(match[2]),
    returns: normalizeSql(match[3]),
    language: match[4].toLowerCase(),
    header: match[5],
    body: match[6],
    full: match[0],
  });
}

for (const fn of [...requiredFunctions, ...replacedFunctions]) {
  const info = functions.get(fn.name);
  const signature = `public.${fn.name}(${fn.args})`;

  if (!info) {
    fail(`Missing function: ${fn.name}`);
    continue;
  }

  if (!/security\s+definer/i.test(info.header)) {
    fail(`${fn.name} is not SECURITY DEFINER`);
  }

  if (!/set\s+search_path\s+to\s+'public'/i.test(info.header)) {
    fail(`${fn.name} does not fix search_path to public`);
  }

  if (!/perform\s+public\._cr_service_role_only_v1\(\)/i.test(info.body)) {
    fail(`${fn.name} does not assert service_role in-body`);
  }

  if (fn.internalActor && !/perform\s+public\._cr_validate_actor_v1\(p_actor_user_id\)/i.test(info.body)) {
    fail(`${fn.name} does not validate internal audit actor`);
  }

  for (const role of ["public", "anon", "authenticated"]) {
    const pattern = new RegExp(
      `revoke all on function\\s+${escapeRegExp(signature)}\\s+from\\s+${role}\\s*;`,
      "i",
    );
    if (!pattern.test(sql)) fail(`Missing ${role} revoke for ${signature}`);
  }

  const grantPattern = new RegExp(
    `grant execute on function\\s+${escapeRegExp(signature)}\\s+to\\s+service_role\\s*;`,
    "i",
  );
  if (!grantPattern.test(sql)) fail(`Missing service_role grant for ${signature}`);
}

for (const helper of helperFunctions) {
  const info = functions.get(helper);
  if (!info) {
    fail(`Missing helper: ${helper}`);
    continue;
  }
  if (!/set\s+search_path\s+to\s+'public'/i.test(info.full)) {
    fail(`${helper} does not fix search_path`);
  }
  for (const role of ["public", "anon", "authenticated"]) {
    if (!new RegExp(`revoke all on function public\\.${helper}[\\s\\S]* from ${role}`, "i").test(sql)) {
      fail(`Missing ${role} revoke for helper ${helper}`);
    }
  }
}

const grantLines = sql.match(/^grant\s+execute\s+on\s+function\b.*$/gim) ?? [];
for (const line of grantLines) {
  if (!/\bto\s+service_role\s*;$/i.test(line)) {
    fail(`Non-service_role execute grant: ${line}`);
  }
}

if (/grant\s+execute\s+on\s+function[\s\S]*\bto\s+(public|anon|authenticated)\b/i.test(sql)) {
  fail("Function EXECUTE granted to PUBLIC, anon, or authenticated");
}

const forbidden = [
  ["legacy invite table", new RegExp(`\\b${legacyInviteTable}\\b`, "i")],
  ["legacy code table", new RegExp(`\\b${legacyCodeTable}\\b`, "i")],
  ["legacy activate route", new RegExp(legacyActivateByCode, "i")],
  ["legacy claim route", new RegExp(legacyClaimInvite, "i")],
  ["auth.users write", /\b(insert\s+into|update|delete\s+from)\s+auth\.users\b/i],
  ["profiles write", /\b(insert\s+into|update|delete\s+from)\s+public\.profiles\b/i],
  ["community_members write", /\b(insert\s+into|update|delete\s+from)\s+public\.community_members\b/i],
  ["house_residents write", /\b(insert\s+into|update|delete\s+from)\s+public\.house_residents\b/i],
  ["resident_activation_queue write", /\b(insert\s+into|update|delete\s+from)\s+public\.resident_activation_queue\b/i],
  ["resident_activation_queue conversion reference", /\bresident_activation_queue\b/i],
  ["token hash returned as JSON key", /'token_hash'/i],
  ["PII copied into events", /community_registration_events[\s\S]{0,1800}jsonb_build_object\([\s\S]{0,1800}'(full_name|email|phone|observation)'/i],
  ["ON DELETE CASCADE", /on\s+delete\s+cascade/i],
];

for (const [name, pattern] of forbidden) {
  if (pattern.test(sql)) fail(`Forbidden pattern present: ${name}`);
}

const requiredPatterns = [
  ["reviews table", /create table if not exists public\.community_registration_reviews/i],
  ["reviews current index", /idx_cr_reviews_one_current_per_unit[\s\S]*where is_current/i],
  ["incomplete authorization table", /community_registration_incomplete_confirmation_authorizations/i],
  ["RLS reviews", /alter table public\.community_registration_reviews enable row level security/i],
  ["RLS incomplete auth", /alter table public\.community_registration_incomplete_confirmation_authorizations enable row level security/i],
  ["token type patronato_review", /token_type\s*=\s*'patronato_review'/i],
  ["patronato token scope campaign", /and campaign_id\s*=\s*p_campaign_id/i],
  ["review stage starts from open", /v_campaign\.status\s*<>\s*'open'/i],
  ["mark reviewed requires review campaign", /mark_community_registration_unit_reviewed_v1[\s\S]*v_campaign\.status <> 'review'/i],
  ["mark reviewed rejects active edit token", /mark_community_registration_unit_reviewed_v1[\s\S]*token_type = 'resident_edit'[\s\S]*status = 'active'/i],
  ["summary resident count active submissions", /s\.status in \('submitted', 'edit_enabled', 'reviewed', 'confirmed'\)/i],
  ["list has no resident PII fields", /list_community_registration_review_units_v1[\s\S]*resident_count/i],
  ["get unit returns resident PII only in detail", /get_community_registration_review_unit_v1[\s\S]*'full_name'[\s\S]*'phone'[\s\S]*'email'/i],
  ["mark reviewed requires submitted", /mark_community_registration_unit_reviewed_v1[\s\S]*status = 'submitted'[\s\S]*v_unit\.status <> 'submitted'/i],
  ["correction requires observation", /_cr_validate_observation_v1/i],
  ["correction requires review campaign", /request_community_registration_correction_v1[\s\S]*v_campaign\.status <> 'review'/i],
  ["correction changes needs_correction", /request_community_registration_correction_v1[\s\S]*set status = 'needs_correction'/i],
  ["unit confirm requires review campaign", /confirm_community_registration_unit_v1[\s\S]*v_campaign\.status <> 'review'/i],
  ["unit confirm requires reviewed", /confirm_community_registration_unit_v1[\s\S]*status = 'reviewed'[\s\S]*v_unit\.status <> 'reviewed'/i],
  ["unit confirm rejects pending correction", /confirm_community_registration_unit_v1[\s\S]*decision = 'correction_requested'[\s\S]*ENTRY_CR_CORRECTION_REQUIRED/i],
  ["unit confirm rejects active edit token", /confirm_community_registration_unit_v1[\s\S]*token_type = 'resident_edit'[\s\S]*ENTRY_CR_CONFIRMATION_CONFLICT/i],
  ["unit confirm rejects newer active version", /confirm_community_registration_unit_v1[\s\S]*version_number > v_submission\.version_number/i],
  ["incomplete auth requires review campaign", /authorize_incomplete_campaign_confirmation_v1[\s\S]*v_campaign\.status <> 'review'/i],
  ["campaign confirm requires review campaign", /confirm_community_registration_campaign_v1[\s\S]*v_campaign\.status <> 'review'/i],
  ["campaign confirm blocks pending states", /status in \('submitted', 'edit_enabled', 'needs_correction', 'reviewed'\)/i],
  ["campaign confirm requires confirmed unit", /v_confirmed_units = 0/i],
  ["campaign confirm checks current submission consistency", /current_submission\.status <> 'confirmed'[\s\S]*current_submission\.patronato_confirmed_at is null/i],
  ["incomplete confirmation requires authorization", /v_authorization\.unregistered_count <> v_unregistered_units/i],
  ["campaign confirmed status", /set status = 'confirmed'[\s\S]*confirmed_at = now\(\)/i],
  ["patronato token consumed on campaign confirmation", /set status = 'consumed'[\s\S]*consumed_at = now\(\)[\s\S]*where id = v_token\.id/i],
  ["edit allowed during review", /v_campaign\.status not in \('open', 'review'\)/i],
  ["reset no confirmed units", /v_unit\.status not in \('submitted', 'edit_enabled', 'needs_correction'\)/i],
  ["no automatic edit token from correction", /request_community_registration_correction_v1[\s\S]*insert into public\.community_registration_reviews/i],
  ["event patronato_access_created", /'patronato_access_created'/i],
  ["event patronato_access_revoked", /'patronato_access_revoked'/i],
  ["event campaign_review_started", /'campaign_review_started'/i],
  ["event unit_reviewed", /'unit_reviewed'/i],
  ["event correction_requested", /'correction_requested'/i],
  ["event unit_confirmed", /'unit_confirmed'/i],
  ["event incomplete_confirmation_authorized", /'incomplete_confirmation_authorized'/i],
  ["event campaign_confirmed", /'campaign_confirmed'/i],
  ["error review not ready", /ENTRY_CR_REVIEW_NOT_READY/i],
  ["error correction required", /ENTRY_CR_CORRECTION_REQUIRED/i],
  ["error already confirmed contract documented", /ENTRY_CR_ALREADY_CONFIRMED/i],
  ["error patronato invalid", /ENTRY_CR_PATRONATO_ACCESS_INVALID/i],
  ["error patronato expired", /ENTRY_CR_PATRONATO_ACCESS_EXPIRED/i],
  ["error campaign incomplete", /ENTRY_CR_CAMPAIGN_INCOMPLETE/i],
  ["error confirmation conflict documented", /ENTRY_CR_CONFIRMATION_CONFLICT/i],
  ["error invalid review state", /ENTRY_CR_INVALID_REVIEW_STATE/i],
];

for (const [name, pattern] of requiredPatterns) {
  if (!pattern.test(sql)) fail(`Missing required pattern: ${name}`);
}

const resolvePatronatoBody = functions.get("resolve_community_registration_patronato_access_v1")?.body ?? "";
const resolveReturn = resolvePatronatoBody.slice(resolvePatronatoBody.lastIndexOf("return jsonb_build_object"));
if (/'campaign_id'|'community_id'|'token_id'|'actor_user_id'|'access_token_id'|'token_hash'/i.test(resolveReturn)) {
  fail("resolve patronato access exposes internal ids, actors, or hashes");
}

const listBody = functions.get("list_community_registration_review_units_v1")?.body ?? "";
const listReturnWindow = listBody.slice(listBody.lastIndexOf("select coalesce(jsonb_agg"));
if (/'full_name'|'email'|'phone'|'token_hash'/i.test(listReturnWindow)) {
  fail("review unit list exposes PII or token data");
}

const topLevelDmlWindow = sql.replace(
  /create or replace function public\.[\s\S]*?\$function\$;/gi,
  "",
);
if (/\binsert\s+into\b|\bupdate\s+public\.(?!community_registration_events\b)|\bdelete\s+from\b/i.test(topLevelDmlWindow)) {
  fail("Unexpected top-level DML outside function bodies");
}

for (const info of functions.values()) {
  if (/\bexecute\s+format\b|\bexecute\s+[a-z_]/i.test(info.body)) {
    fail(`Dynamic SQL present in ${info.name}`);
  }
}

let parenDepth = 0;
let inSingleQuote = false;
let inDollarQuote = false;

for (let i = 0; i < sql.length; i += 1) {
  const current = sql[i];
  const next = sql[i + 1];

  if (!inSingleQuote && sql.startsWith("$function$", i)) {
    inDollarQuote = !inDollarQuote;
    i += "$function$".length - 1;
    continue;
  }
  if (inDollarQuote) continue;
  if (current === "'" && next === "'") {
    i += 1;
    continue;
  }
  if (current === "'") {
    inSingleQuote = !inSingleQuote;
    continue;
  }
  if (inSingleQuote) continue;
  if (current === "(") parenDepth += 1;
  if (current === ")") parenDepth -= 1;
  if (parenDepth < 0) fail("SQL parentheses close before they open");
}

if (parenDepth !== 0) fail(`SQL parentheses are unbalanced: depth ${parenDepth}`);
if (inSingleQuote) fail("SQL single quote is unclosed");
if (inDollarQuote) fail("SQL dollar quote is unclosed");
if (!normalized.trim().endsWith(";")) fail("SQL migration does not end with a semicolon");

if (failures.length > 0) {
  console.error("ENTRY-ONB-003 review validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("ENTRY-ONB-003 review validation passed.");
