import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

function migrationNameBySuffix(suffix, source = readdirSync(resolve("supabase/migrations"))) {
  const matches = source.filter((name) => name.endsWith(suffix));
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one migration ending in ${suffix}; found ${matches.length}`);
  }
  return matches[0];
}

function migrationPathBySuffix(suffix) {
  return resolve("supabase/migrations", migrationNameBySuffix(suffix));
}

function headMigrationBySuffix(suffix) {
  const headFiles = execFileSync("git", [
    "ls-tree",
    "-r",
    "--name-only",
    "HEAD",
    "supabase/migrations",
  ], { encoding: "utf8" })
    .split(/\r?\n/)
    .filter(Boolean)
    .map((path) => path.replace(/^supabase\/migrations\//, ""));
  return `supabase/migrations/${migrationNameBySuffix(suffix, headFiles)}`;
}

const migrationSuffix = "_create_entry_community_registration_backend_v1.sql";
const migrationPath = migrationPathBySuffix(migrationSuffix);
const schemaV1Path = migrationPathBySuffix(
  "_create_entry_community_registration_schema_v1.sql",
);

const sql = readFileSync(migrationPath, "utf8");
const schemaV1 = readFileSync(schemaV1Path, "utf8");
const schemaV1Head = execFileSync("git", [
  "show",
  `HEAD:${headMigrationBySuffix("_create_entry_community_registration_schema_v1.sql")}`,
], { encoding: "utf8" });

const failures = [];
const lower = sql.toLowerCase();
const normalized = lower.replace(/\s+/g, " ");
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

if (schemaV1.replace(/\r\n/g, "\n") !== schemaV1Head.replace(/\r\n/g, "\n")) {
  fail("ENTRY-ONB-001 migration changed relative to HEAD");
}

if (!readdirSync(resolve("supabase/migrations")).includes(migrationNameBySuffix(migrationSuffix))) {
  fail("Missing ENTRY-ONB-002 backend migration");
}

const requiredFunctions = [
  {
    name: "create_community_registration_campaign_v1",
    args: "uuid, text, text, text, text, integer, timestamptz, timestamptz, text, uuid",
    actor: "internal",
    mutates: true,
  },
  {
    name: "add_community_registration_units_v1",
    args: "uuid, uuid[], jsonb, uuid",
    actor: "internal",
    mutates: true,
  },
  {
    name: "resolve_community_registration_campaign_v1",
    args: "text, text",
    actor: "public_backend",
    mutates: false,
  },
  {
    name: "lookup_community_registration_unit_v1",
    args: "text, text, text",
    actor: "public_backend",
    mutates: false,
  },
  {
    name: "submit_community_registration_household_v1",
    args: "text, text, text, jsonb, jsonb",
    actor: "public_backend",
    mutates: true,
  },
  {
    name: "enable_community_registration_edit_v1",
    args: "uuid, text, timestamptz, uuid, text",
    actor: "internal",
    mutates: true,
  },
  {
    name: "resolve_community_registration_edit_v1",
    args: "text",
    actor: "public_backend",
    mutates: false,
  },
  {
    name: "resubmit_community_registration_household_v1",
    args: "text, jsonb",
    actor: "public_backend",
    mutates: true,
  },
  {
    name: "reset_community_registration_unit_v1",
    args: "uuid, uuid, text",
    actor: "internal",
    mutates: true,
  },
  {
    name: "get_community_registration_unit_state_v1",
    args: "uuid",
    actor: "internal_read",
    mutates: false,
  },
];

const helperFunctions = [
  "_cr_service_role_only_v1",
  "_cr_raise_v1",
  "_cr_validate_actor_v1",
  "_cr_normalize_slug_v1",
  "_cr_normalize_unit_label_v1",
  "_cr_normalize_name_v1",
  "_cr_normalize_email_v1",
  "_cr_normalize_phone_v1",
  "_cr_validate_residents_v1",
];

const functionMatches = [
  ...sql.matchAll(
    /create or replace function public\.([a-z0-9_]+)\s*\(([\s\S]*?)\)\s*returns\s+([a-z0-9_\[\] ]+)\s+language\s+([a-z]+)([\s\S]*?)as\s+\$function\$([\s\S]*?)\$function\$;/gi,
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

const actualRpcNames = requiredFunctions.map((fn) => fn.name).sort();
const foundRpcNames = [...functions.keys()]
  .filter((name) => requiredFunctions.some((fn) => fn.name === name))
  .sort();

if (JSON.stringify(actualRpcNames) !== JSON.stringify(foundRpcNames)) {
  fail(`RPC list mismatch: found ${foundRpcNames.join(", ")}`);
}

for (const helper of helperFunctions) {
  if (!functions.has(helper)) fail(`Missing helper: ${helper}`);
}

for (const fn of requiredFunctions) {
  const info = functions.get(fn.name);
  const signature = `public.${fn.name}(${fn.args})`;

  if (!info) continue;
  if (!/security\s+definer/i.test(info.header)) {
    fail(`${fn.name} is not SECURITY DEFINER`);
  }
  if (!/set\s+search_path\s+to\s+'public'/i.test(info.header)) {
    fail(`${fn.name} does not fix search_path to public`);
  }
  if (!/perform\s+public\._cr_service_role_only_v1\(\)/i.test(info.body)) {
    fail(`${fn.name} does not assert service_role in-body`);
  }
  if (fn.actor === "internal" && !/perform\s+public\._cr_validate_actor_v1\(p_actor_user_id\)/i.test(info.body)) {
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
  if (!info) continue;
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

const outsideFunctions = sql.replace(
  /create or replace function public\.[\s\S]*?\$function\$;/gi,
  "",
);

if (/\binsert\s+into\b|\bupdate\s+public\.|\bdelete\s+from\b/i.test(outsideFunctions)) {
  fail("Unexpected top-level DML outside function bodies");
}

const forbidden = [
  ["legacy invite table", new RegExp(`\\b${legacyInviteTable}\\b`, "i")],
  ["legacy code table", new RegExp(`\\b${legacyCodeTable}\\b`, "i")],
  ["legacy activate route", new RegExp(legacyActivateByCode, "i")],
  ["legacy claim route", new RegExp(legacyClaimInvite, "i")],
  ["auth.users write", /\binsert\s+into\s+auth\.users\b/i],
  ["profiles write", /\binsert\s+into\s+public\.profiles\b/i],
  ["community_members write", /\binsert\s+into\s+public\.community_members\b/i],
  ["house_residents write", /\binsert\s+into\s+public\.house_residents\b/i],
  ["resident_activation_queue write", /\binsert\s+into\s+public\.resident_activation_queue\b/i],
  ["ON DELETE CASCADE", /on\s+delete\s+cascade/i],
  ["reset uses DELETE", /reset_community_registration_unit_v1[\s\S]*\bdelete\s+from\b/i],
  ["token hash output", /jsonb_build_object[\s\S]*'token_hash'/i],
];

for (const [name, pattern] of forbidden) {
  if (pattern.test(sql)) fail(`Forbidden pattern present: ${name}`);
}

for (const info of functions.values()) {
  if (/\bexecute\s+format\b|\bexecute\s+[a-z_]/i.test(info.body)) {
    fail(`Dynamic SQL present in ${info.name}`);
  }
}

const requiredPatterns = [
  ["event constraint widened", /alter table public\.community_registration_events[\s\S]*cr_events_type_check/i],
  ["campaign event", /'campaign_created'/i],
  ["units event", /'units_added'/i],
  ["submission event", /'household_submitted'/i],
  ["edit enabled event", /'resident_edit_enabled'/i],
  ["edit revoke event", /'resident_edit_token_revoked'/i],
  ["resubmit event", /'household_resubmitted'/i],
  ["reset event", /'registration_reset'/i],
  ["campaign token hash parameter", /p_campaign_token_hash\s+text/i],
  ["edit token hash parameter", /p_edit_token_hash\s+text/i],
  ["campaign token hash lookup", /token_hash\s*=\s*btrim\(coalesce\(p_campaign_token_hash/i],
  ["edit token hash lookup", /token_hash\s*=\s*btrim\(coalesce\(p_edit_token_hash/i],
  ["unit lock", /from public\.community_registration_units[\s\S]*for update/i],
  ["token lock", /from public\.community_registration_access_tokens[\s\S]*for update/i],
  ["submission lock", /from public\.community_registration_submissions[\s\S]*for update/i],
  ["limit coalesce", /coalesce\(v_unit\.resident_limit_override,\s*v_campaign\.default_resident_limit\)/i],
  ["resident count limit", /v_count\s*>\s*p_effective_limit/i],
  ["resident length limits", /length\(v_name\) > 160[\s\S]*length\(v_email\) > 254[\s\S]*length\(v_phone\) > 32/i],
  ["unexpected resident fields rejected", /jsonb_object_keys\(v_item\)[\s\S]*payload_key\.key_name not in/i],
  ["metadata object validation", /jsonb_typeof\(p_technical_metadata\)/i],
  ["resubmit new version", /max\(version_number\)[\s\S]*\+\s*1/i],
  ["previous submission relation", /previous_submission_id/i],
  ["old submission superseded", /status\s*=\s*'superseded'/i],
  ["token consumed", /status\s*=\s*'consumed'[\s\S]*consumed_at\s*=\s*now\(\)/i],
  ["reset invalidates", /status\s*=\s*'invalidated'[\s\S]*invalidated_at\s*=\s*now\(\)/i],
  ["reset revokes tokens", /status\s*=\s*'revoked'[\s\S]*revoked_at\s*=\s*now\(\)/i],
  ["reset rejects processed", /v_unit\.status not in \('submitted', 'edit_enabled', 'needs_correction', 'reviewed', 'confirmed'\)/i],
  ["reset idempotent unregistered", /already_unregistered/i],
  ["neutral public message", /No fue posible iniciar el registro para esa vivienda/i],
  ["bounded internal versions", /from public\.community_registration_submissions[\s\S]*limit 25/i],
];

for (const [name, pattern] of requiredPatterns) {
  if (!pattern.test(sql)) fail(`Missing required pattern: ${name}`);
}

const submitBody = functions.get("submit_community_registration_household_v1")?.body ?? "";
const resubmitBody = functions.get("resubmit_community_registration_household_v1")?.body ?? "";
const resolveEditBody = functions.get("resolve_community_registration_edit_v1")?.body ?? "";

for (const [name, body] of [
  ["submit receipt", submitBody],
  ["resubmit receipt", resubmitBody],
]) {
  const returnTail = body.slice(body.lastIndexOf("return jsonb_build_object"));
  if (/'submission_id'|'previous_submission_id'|'campaign_unit_id'/.test(returnTail)) {
    fail(`${name} exposes internal IDs`);
  }
}

const resolveEditReturn = resolveEditBody.slice(resolveEditBody.lastIndexOf("return jsonb_build_object"));
if (/'submission_id'|'campaign_unit_id'|'token_hash'/.test(resolveEditReturn)) {
  fail("resolve edit exposes unnecessary internal IDs or token hash");
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
  console.error("ENTRY-ONB-002 backend validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("ENTRY-ONB-002 backend validation passed.");
