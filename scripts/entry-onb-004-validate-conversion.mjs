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

function migrationRepoPathBySuffix(suffix) {
  return `supabase/migrations/${migrationNameBySuffix(suffix)}`;
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

const migrationSuffix = "_create_entry_community_registration_conversion_v1.sql";
const migrationPath = migrationPathBySuffix(migrationSuffix);
const migration001 = migrationRepoPathBySuffix(
  "_create_entry_community_registration_schema_v1.sql",
);
const migration002 = migrationRepoPathBySuffix(
  "_create_entry_community_registration_backend_v1.sql",
);
const migration003 = migrationRepoPathBySuffix(
  "_create_entry_community_registration_review_v1.sql",
);

const sql = readFileSync(migrationPath, "utf8");
const lower = sql.toLowerCase();
const normalized = lower.replace(/\s+/g, " ");
const failures = [];

function fail(message) {
  failures.push(message);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeSql(value) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function assertHeadUnchanged(path) {
  const current = readFileSync(resolve(path), "utf8").replace(/\r\n/g, "\n");
  const suffix = path.slice(path.indexOf("_create_entry_community_registration_"));
  const head = execFileSync("git", ["show", `HEAD:${headMigrationBySuffix(suffix)}`], {
    encoding: "utf8",
  }).replace(/\r\n/g, "\n");
  if (current !== head) fail(`${path} changed relative to HEAD`);
}

if (!readdirSync(resolve("supabase/migrations")).includes(migrationNameBySuffix(migrationSuffix))) {
  fail("Missing ENTRY-ONB-004 conversion migration");
}

for (const path of [migration001, migration002, migration003]) {
  assertHeadUnchanged(path);
}

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

const rpcs = [
  {
    name: "preview_community_registration_unit_conversion_v1",
    args: "uuid, uuid",
  },
  {
    name: "convert_community_registration_unit_to_activation_v1",
    args: "uuid, uuid, text",
  },
  {
    name: "list_community_registration_units_pending_conversion_v1",
    args: "uuid, integer, integer, uuid",
  },
  {
    name: "get_community_registration_conversion_result_v1",
    args: "uuid, uuid",
  },
  {
    name: "mark_community_registration_campaign_processed_v1",
    args: "uuid, uuid",
  },
];

const helpers = [
  "_cr_conversion_normalize_email_v1",
  "_cr_conversion_normalize_phone_v1",
  "_cr_conversion_normalize_name_v1",
  "_cr_conversion_activation_method_v1",
  "_cr_conversion_suggest_username_v1",
  "_cr_conversion_lock_identity_v1",
  "_cr_conversion_event_v1",
  "_cr_classify_unit_conversion_v1",
];

for (const helper of helpers) {
  const info = functions.get(helper);
  if (!info) {
    fail(`Missing helper: ${helper}`);
    continue;
  }
  if (!/set\s+search_path\s+to\s+'public'/i.test(info.full)) {
    fail(`${helper} does not set search_path`);
  }
  for (const role of ["public", "anon", "authenticated"]) {
    if (
      !new RegExp(
        `revoke all on function public\\.${helper}[\\s\\S]* from ${role}`,
        "i",
      ).test(sql)
    ) {
      fail(`Missing ${role} revoke for helper ${helper}`);
    }
  }
}

for (const fn of rpcs) {
  const info = functions.get(fn.name);
  const signature = `public.${fn.name}(${fn.args})`;

  if (!info) {
    fail(`Missing RPC: ${fn.name}`);
    continue;
  }

  if (!/security\s+definer/i.test(info.header)) {
    fail(`${fn.name} is not SECURITY DEFINER`);
  }
  if (!/set\s+search_path\s+to\s+'public'/i.test(info.header)) {
    fail(`${fn.name} does not fix search_path`);
  }
  if (!/perform\s+public\._cr_service_role_only_v1\(\)/i.test(info.body)) {
    fail(`${fn.name} does not assert service_role`);
  }
  if (!/perform\s+public\._cr_validate_actor_v1\(p_actor_user_id\)/i.test(info.body)) {
    fail(`${fn.name} does not validate actor`);
  }
  if (!/p_actor_user_id\s+is\s+null/i.test(info.body)) {
    fail(`${fn.name} does not reject missing actor`);
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

const requiredPatterns = [
  ["RAQ traceability column", /alter table public\.resident_activation_queue[\s\S]*community_registration_resident_id uuid null/i],
  ["RAQ FK", /raq_community_registration_resident_fk[\s\S]*references public\.community_registration_residents\(id\)[\s\S]*on delete restrict/i],
  ["RAQ unique source index", /ux_raq_community_registration_resident[\s\S]*where community_registration_resident_id is not null/i],
  ["RAQ nullable no default", /add column if not exists community_registration_resident_id uuid null/i],
  ["source community_registration_v1", /'community_registration_v1'/i],
  ["resident actor column", /conversion_actor_user_id uuid[\s\S]*references auth\.users\(id\)/i],
  ["resident attempt timestamp", /conversion_last_attempted_at timestamptz/i],
  ["status converted", /'converted'/i],
  ["status already_queued", /'already_queued'/i],
  ["status already_active", /'already_active'/i],
  ["status queue_conflict", /'queue_conflict'/i],
  ["status identity_ambiguous", /'identity_ambiguous'/i],
  ["status active other context", /'active_identity_other_context'/i],
  ["status traceability conflict", /'traceability_conflict'/i],
  ["already active may link activated RAQ", /'prepared',\s*'converted',\s*'already_queued',\s*'already_active'/i],
  ["campaign confirmed required", /v_campaign\.status <> 'confirmed'/i],
  ["unit confirmed required", /v_unit\.status <> 'confirmed'/i],
  ["current submission confirmed", /v_submission\.status <> 'confirmed'/i],
  ["confirmation timestamp check", /patronato_confirmed_at is null/i],
  ["edit token active check", /token_type = 'resident_edit'[\s\S]*status = 'active'/i],
  ["newer submission check", /newer\.version_number > v_submission\.version_number/i],
  ["semantic RAQ states", /status in \('pending', 'invited', 'pin_generated', 'activated'\)/i],
  ["skipped failed manual", /status in \('skipped', 'failed'\)/i],
  ["active user read", /from auth\.users au[\s\S]*join public\.profiles|from auth\.users au[\s\S]*left join public\.profiles/i],
  ["membership read", /public\.community_members/i],
  ["house residents read", /public\.house_residents/i],
  ["advisory email identity", /v_identity := 'email:' \|\| v_email/i],
  ["advisory phone identity", /v_identity := 'phone:' \|\| v_phone/i],
  ["advisory name-only identity", /v_identity := 'name-only:'/i],
  ["advisory identity lock", /pg_advisory_xact_lock\(hashtextextended\('entry-cr-conversion\|'/i],
  ["RAQ row lock", /from public\.resident_activation_queue q[\s\S]*for update/i],
  ["resident row lock", /from public\.community_registration_residents r[\s\S]*for update/i],
  ["duplicate RAQ claim guard", /v_claimed_queue_ids[\s\S]*v_related_queue_id = any\(v_claimed_queue_ids\)/i],
  ["activated RAQ requires user", /v_queue\.status = 'activated' and v_queue\.activated_user_id is null/i],
  ["linked RAQ null-house unit revalidation", /v_queue\.house_id is null[\s\S]*normalize_unit_label\(v_queue\.unit_label\)/i],
  ["unique violation retry", /exception[\s\S]*when unique_violation[\s\S]*community_registration_resident_id = v_resident\.id/i],
  ["username helper RAQ collision check", /_cr_conversion_suggest_username_v1[\s\S]*resident_activation_queue q[\s\S]*suggested_username/i],
  ["username helper profiles collision check", /_cr_conversion_suggest_username_v1[\s\S]*profiles p[\s\S]*username/i],
  ["username helper resident hash suffix", /v_base := left\(v_base, 20\) \|\| '_' \|\| v_seed/i],
  ["partial write block", /blocking_count[\s\S]*resident_conversion_blocked[\s\S]*return jsonb_build_object/i],
  ["unit processed only after terminal", /conversion_status not in \('converted', 'already_queued', 'already_active'\)/i],
  ["submission converted", /update public\.community_registration_submissions[\s\S]*status = 'converted'/i],
  ["unit processed", /update public\.community_registration_units[\s\S]*status = 'processed'/i],
  ["campaign processed", /update public\.community_registration_campaigns[\s\S]*status = 'processed'/i],
  ["pagination capped", /least\(greatest\(coalesce\(p_limit, 50\), 1\), 100\)/i],
  ["event resident created", /'resident_conversion_created'/i],
  ["event resident reused", /'resident_conversion_reused_queue'/i],
  ["event already active", /'resident_conversion_already_active'/i],
  ["event blocked", /'resident_conversion_blocked'/i],
  ["event unit completed", /'unit_conversion_completed'/i],
  ["event campaign completed", /'campaign_processing_completed'/i],
  ["error retryable", /ENTRY_CR_CONVERSION_RETRYABLE/i],
  ["error not ready", /ENTRY_CR_CONVERSION_NOT_READY/i],
  ["error already complete", /already_complete/i],
  ["error invalid", /ENTRY_CR_RESIDENT_INVALID/i],
  ["error conflict", /ENTRY_CR_RESIDENT_CONFLICT/i],
  ["error ambiguous", /ENTRY_CR_IDENTITY_AMBIGUOUS/i],
  ["error queue conflict", /ENTRY_CR_QUEUE_CONFLICT/i],
  ["error stale", /ENTRY_CR_CONFIRMATION_STALE/i],
  ["error incomplete", /ENTRY_CR_CONVERSION_INCOMPLETE/i],
  ["error traceability", /ENTRY_CR_TRACEABILITY_CONFLICT/i],
];

for (const [name, pattern, mustBeAbsent] of requiredPatterns) {
  const found = pattern.test(sql);
  if (mustBeAbsent ? found : !found) {
    fail(`${mustBeAbsent ? "Forbidden pattern present" : "Missing required pattern"}: ${name}`);
  }
}

const forbidden = [
  ["confirm_resident_bulk_import_v1 call", /\bconfirm_resident_bulk_import_v1\s*\(/i],
  ["generate PIN call", /\bgenerate_resident_activation_pins_v1\s*\(/i],
  ["complete activation call", /\bcomplete_resident_activation_pin_v1\s*\(/i],
  ["activation PIN writes", /\b(insert\s+into|update|delete\s+from)\s+public\.resident_activation_pins\b/i],
  ["auth users write", /\b(insert\s+into|update|delete\s+from)\s+auth\.users\b/i],
  ["profiles write", /\b(insert\s+into|update|delete\s+from)\s+public\.profiles\b/i],
  ["community members write", /\b(insert\s+into|update|delete\s+from)\s+public\.community_members\b/i],
  ["house residents write", /\b(insert\s+into|update|delete\s+from)\s+public\.house_residents\b/i],
  ["delete statement", /\bdelete\s+from\b/i],
  ["truncate statement", /\btruncate\b/i],
  ["seed DML values", /\binsert\s+into\s+public\.(?!resident_activation_queue|community_registration_events\b)/i],
  ["event full name", /community_registration_events[\s\S]{0,1200}'full_name'/i],
  ["event email", /community_registration_events[\s\S]{0,1200}'email'/i],
  ["event phone", /community_registration_events[\s\S]{0,1200}'phone'/i],
  ["raw data full name", /raw_data[\s\S]{0,500}'full_name'/i],
  ["raw data email", /raw_data[\s\S]{0,500}'email'/i],
  ["raw data phone", /raw_data[\s\S]{0,500}'phone'/i],
  ["grant public execute", /grant execute on function[\s\S]*\bto\s+(public|anon|authenticated)\b/i],
];

for (const [name, pattern] of forbidden) {
  if (pattern.test(sql)) fail(`Forbidden pattern present: ${name}`);
}

const convert = functions.get("convert_community_registration_unit_to_activation_v1");
if (convert) {
  const insertCount = (convert.body.match(/insert into public\.resident_activation_queue/gi) ?? []).length;
  if (insertCount !== 1) fail(`Expected one approved RAQ insert, found ${insertCount}`);
  if (/source\s*=/.test(convert.body)) fail("Conversion overwrites RAQ source");
}

const outsideFunctions = sql.replace(
  /create or replace function public\.[\s\S]*?\$function\$;/gi,
  "",
);
if (/\binsert\s+into\s+public\.resident_activation_queue\b/i.test(outsideFunctions)) {
  fail("RAQ insert appears outside approved conversion function");
}
if (/update\s+public\.resident_activation_queue[\s\S]*community_registration_resident_id/i.test(outsideFunctions)) {
  fail("RAQ traceability backfill appears outside approved conversion function");
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
  console.error("ENTRY-ONB-004 conversion validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("ENTRY-ONB-004 conversion validation passed.");
