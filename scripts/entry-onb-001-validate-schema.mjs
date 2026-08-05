import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve(
  "supabase/migrations/20260805000100_create_entry_community_registration_schema_v1.sql",
);

const sql = readFileSync(migrationPath, "utf8");
const normalized = sql.replace(/\s+/g, " ").toLowerCase();

const checks = [
  ["campaigns table", /create table if not exists public\.community_registration_campaigns/i],
  ["units table", /create table if not exists public\.community_registration_units/i],
  ["submissions table", /create table if not exists public\.community_registration_submissions/i],
  ["residents table", /create table if not exists public\.community_registration_residents/i],
  ["access tokens table", /create table if not exists public\.community_registration_access_tokens/i],
  ["events table", /create table if not exists public\.community_registration_events/i],
  ["default resident limit is 3", /default_resident_limit\s+integer\s+not null default 3/i],
  ["unit limit override positive", /cr_units_limit_override_positive[\s\S]*resident_limit_override is null or resident_limit_override > 0/i],
  ["one house per campaign", /cr_units_campaign_house_unique[\s\S]*unique \(campaign_id, house_id\)/i],
  ["one active campaign per community", /idx_cr_campaigns_one_active_per_community[\s\S]*where status in \('open', 'paused', 'review', 'confirmed'\)/i],
  ["one normalized label per campaign", /idx_cr_units_campaign_normalized_label_unique[\s\S]*\(campaign_id, normalized_unit_label\)/i],
  ["active submission uniqueness", /idx_cr_submissions_one_active_per_unit/i],
  ["no current submission pointer", /current_submission_id/i, true],
  ["version chain scoped to unit", /cr_submissions_previous_same_unit_fk[\s\S]*foreign key \(campaign_unit_id, previous_submission_id\)/i],
  ["no reverse version pointer", /superseded_by_submission_id/i, true],
  ["resident position uniqueness", /cr_residents_submission_position_unique[\s\S]*unique \(submission_id, position\)/i],
  ["activation queue traceability", /activation_queue_id\s+uuid/i],
  ["hash-only token storage", /token_hash\s+text\s+not null/i],
  ["campaign stores no token hash", /access_token_hash/i, true],
  ["token type scope check", /cr_tokens_scope_check/i],
  ["token hash globally unique", /idx_cr_tokens_hash_unique/i],
  ["one active edit token per submission", /idx_cr_tokens_one_active_edit_per_submission/i],
  ["one active campaign access token", /idx_cr_tokens_one_active_campaign_access/i],
  ["one active patronato review token", /idx_cr_tokens_one_active_patronato_review/i],
  ["events scoped to submission unit", /cr_events_submission_scope_fk[\s\S]*foreign key \(submission_id, campaign_unit_id, campaign_id\)/i],
  ["events metadata object", /cr_events_metadata_object/i],
  ["RLS campaigns", /alter table public\.community_registration_campaigns enable row level security/i],
  ["RLS units", /alter table public\.community_registration_units enable row level security/i],
  ["RLS submissions", /alter table public\.community_registration_submissions enable row level security/i],
  ["RLS residents", /alter table public\.community_registration_residents enable row level security/i],
  ["RLS tokens", /alter table public\.community_registration_access_tokens enable row level security/i],
  ["RLS events", /alter table public\.community_registration_events enable row level security/i],
  ["deny direct grants campaigns", /revoke all on table public\.community_registration_campaigns from public, anon, authenticated/i],
  ["deny direct grants units", /revoke all on table public\.community_registration_units from public, anon, authenticated/i],
  ["deny direct grants submissions", /revoke all on table public\.community_registration_submissions from public, anon, authenticated/i],
  ["deny direct grants residents", /revoke all on table public\.community_registration_residents from public, anon, authenticated/i],
  ["deny direct grants tokens", /revoke all on table public\.community_registration_access_tokens from public, anon, authenticated/i],
  ["deny direct grants events", /revoke all on table public\.community_registration_events from public, anon, authenticated/i],
];

const forbidden = [
  ["legacy resident_invites", /\bresident_invites\b/i],
  ["legacy account_activation_codes", /\baccount_activation_codes\b/i],
  ["legacy activate-account-by-code", /activate-account-by-code/i],
  ["legacy claim-resident-invite", /claim-resident-invite/i],
  ["production seed insert", /\binsert\s+into\s+public\./i],
  ["destructive drop table", /\bdrop\s+table\b/i],
  ["destructive cascade delete", /on delete cascade/i],
  ["auth user creation", /\bauth\.users\b[\s\S]*insert/i],
];

const failures = [];
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
  if (parenDepth < 0) failures.push("SQL parentheses close before they open");
}

if (parenDepth !== 0) failures.push(`SQL parentheses are unbalanced: depth ${parenDepth}`);
if (inSingleQuote) failures.push("SQL single quote is unclosed");
if (inDollarQuote) failures.push("SQL dollar quote is unclosed");
if (!sql.trim().endsWith(";")) failures.push("SQL migration does not end with a semicolon");

for (const [name, pattern, mustBeAbsent] of checks) {
  const found = pattern.test(sql);
  if (mustBeAbsent ? found : !found) {
    failures.push(`${mustBeAbsent ? "Forbidden pattern present" : "Missing check"}: ${name}`);
  }
}

for (const [name, pattern] of forbidden) {
  if (pattern.test(sql)) failures.push(`Forbidden pattern present: ${name}`);
}

if (!normalized.includes("references public.resident_activation_queue")) {
  failures.push("Missing future traceability FK to resident_activation_queue");
}

if (failures.length > 0) {
  console.error("ENTRY-ONB-001 schema validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("ENTRY-ONB-001 schema validation passed.");
