import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const ROOT = new URL("../", import.meta.url);

function read(path) {
  return readFileSync(new URL(path, ROOT), "utf8");
}

function git(args) {
  return execFileSync("git", args, {
    cwd: new URL(".", ROOT),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function assert(name, condition) {
  if (!condition) {
    throw new Error(name);
  }
  console.log(`PASS ${name}`);
}

const diffNames = [
  ...git(["diff", "--name-only"]).split(/\r?\n/),
  ...git(["ls-files", "--others", "--exclude-standard"]).split(/\r?\n/),
].filter(Boolean);

const actions = read("features/entry/communityRegistration/review/actions.ts");
const workspace = read(
  "features/entry/communityRegistration/review/ReviewWorkspace.tsx",
);
const backendSql = read(
  "supabase/migrations/20260806233000_create_entry_community_registration_backend_v1.sql",
);
const reviewSql = read(
  "supabase/migrations/20260806234000_create_entry_community_registration_review_v1.sql",
);
const conversionSql = read(
  "supabase/migrations/20260806235000_create_entry_community_registration_conversion_v1.sql",
);
const progressiveSql = read(
  "supabase/migrations/20260820192138_entry_onb_012_progressive_unit_activation_handoff.sql",
);
const runtimeHotfixSql = read(
  "supabase/migrations/20260821070500_entry_onb_012_fix_uuid_conversion_classifier.sql",
);

assert(
  "ONB-012 scope is limited to review handoff UI/action and validator",
  diffNames.every(
    (name) =>
      name === "features/entry/communityRegistration/review/actions.ts" ||
      name === "features/entry/communityRegistration/review/ReviewWorkspace.tsx" ||
      name === "scripts/entry-onb-008-validate-review-ui.mjs" ||
      name === "scripts/entry-onb-012-validate-review-activation-handoff.mjs" ||
      name === "scripts/entry-onb-012-validate-runtime-hotfix.mjs" ||
      name ===
        "supabase/migrations/20260820192138_entry_onb_012_progressive_unit_activation_handoff.sql" ||
      name ===
        "supabase/migrations/20260821070500_entry_onb_012_fix_uuid_conversion_classifier.sql",
  ),
);

assert(
  "ONB-012 adds only the reviewed forward migrations",
  diffNames
    .filter((name) => name.startsWith("supabase/migrations/"))
    .every(
      (name) =>
        name ===
          "supabase/migrations/20260820192138_entry_onb_012_progressive_unit_activation_handoff.sql" ||
        name ===
          "supabase/migrations/20260821070500_entry_onb_012_fix_uuid_conversion_classifier.sql",
    ),
);

assert(
  "handoff action is wired to a real Server Action",
  /export async function confirmAndPrepareCommunityRegistrationActivation/.test(
    actions,
  ) &&
    /useActionState\(\s*confirmAndPrepareCommunityRegistrationActivation/.test(
      workspace,
    ) &&
    /<form[\s\S]*action=\{formAction\}[\s\S]*Confirmar y preparar activaci[oó]n/.test(
      workspace,
    ),
);

assert(
  "handoff uses unit-level external approval and canonical ONB-004 conversion",
  /record_community_registration_unit_external_approval_v1/.test(actions) &&
    /convert_community_registration_unit_to_activation_v1/.test(actions) &&
    /get_community_registration_conversion_result_v1/.test(actions) &&
    !/create_community_registration_patronato_access_v1/.test(actions) &&
    !/authorize_incomplete_campaign_confirmation_v1/.test(actions) &&
    !/confirm_community_registration_campaign_v1/.test(actions) &&
    !/mark_community_registration_campaign_processed_v1/.test(actions),
);

assert(
  "progressive review never requires campaign-wide start review",
  /const reviewCapable = \["open", "review"\]\.includes\(campaignStatus\)/.test(
    workspace,
  ) &&
    /const canMarkReviewed = reviewCapable && selectedStatus === "submitted"/.test(
      workspace,
    ) &&
    !/startCommunityRegistrationReview/.test(workspace) &&
    !/start_community_registration_review_v1/.test(workspace),
);

assert(
  "normal Review Workspace exposes no accidental campaign-wide review start CTA",
  !/StartReviewDialog|showStartReview|setShowStartReview|canStartReview/.test(
    workspace,
  ) &&
    !/Start review|Starting review|Start internal review|campaign-wide review/.test(
      workspace,
    ) &&
    /Registration is open\.[\s\S]*Submitted households can be reviewed[\s\S]*other units continue registering/.test(
      workspace,
    ),
);

assert(
  "handoff preserves existing backend authorization boundary",
  /requireSuperadmin\(\)/.test(actions) &&
    /createAdminClient\(\)/.test(actions) &&
    /p_actor_user_id:\s*auth\.user\.id/.test(actions) &&
    !/token_hash/.test(workspace) &&
    !/patronatoTokenHash/.test(workspace + actions),
);

assert(
  "browser receives no capability secret and no queue authority",
  !/community_registration_access_tokens/.test(actions + workspace) &&
    !/\.from\(\s*["']resident_activation_queue["']/.test(actions) &&
    !/\b(insert|update|delete)\b[\s\S]{0,160}resident_activation_queue/i.test(
      actions,
    ),
);

assert(
  "ONB-012 does not create users, PINs, activation messages, or Auth identities",
  !/generate_resident_activation_pins_v1|complete_resident_activation_pin_v1|start_onboarding_email_campaign_v1|auth\.admin|auth\.users|resident_activation_pins/i.test(
    actions + workspace,
  ),
);

assert(
  "partial conversion outcome is represented honestly",
  /External Patronato approval is recorded for this unit/.test(actions) &&
    /Activation Queue preparation did not complete/.test(actions) &&
    /ENTRY_ONB_012_CONVERSION_RPC_FAILED/.test(actions) &&
    /console\.error\(diagnosticCode/.test(actions),
);

assert(
  "prepared state links to existing Activation Queue route",
  /activationQueueUrl/.test(actions + workspace) &&
    /\/products\/entry\/activation\?community_id=/.test(actions + workspace) &&
    /Ver en Activation Queue/.test(workspace),
);

assert(
  "review screen shows handoff state progression",
  /function HandoffProgress/.test(workspace) &&
    /Submitted/.test(workspace) &&
    /Reviewed/.test(workspace) &&
    /Patronato confirmed/.test(workspace) &&
    /Prepared for activation/.test(workspace),
);

assert(
  "progressive migration records external approval per unit only",
  /create or replace function public\.record_community_registration_unit_external_approval_v1/.test(
    progressiveSql,
  ) &&
    /if not found or v_campaign\.status not in \('open', 'review', 'confirmed'\)/.test(
      progressiveSql,
    ) &&
    /if v_unit\.status <> 'reviewed'/.test(progressiveSql) &&
    /status = 'confirmed'[\s\S]*patronato_confirmed_at = now\(\)/.test(
      progressiveSql,
    ) &&
    /campaign_status_preserved/.test(progressiveSql) &&
    !/create_community_registration_patronato_access_v1/.test(progressiveSql),
);

const externalApprovalFunction =
  progressiveSql.match(
    /create or replace function public\.record_community_registration_unit_external_approval_v1[\s\S]*?\$function\$;/,
  )?.[0] ?? "";
const conversionFunction =
  progressiveSql.match(
    /create or replace function public\.convert_community_registration_unit_to_activation_v1[\s\S]*?\$function\$;/,
  )?.[0] ?? "";

assert(
  "101 progressive processing does not change campaign status",
  /campaign_status_preserved/.test(externalApprovalFunction) &&
    !/update\s+public\.community_registration_campaigns/i.test(
      externalApprovalFunction,
    ) &&
    !/update\s+public\.community_registration_campaigns/i.test(conversionFunction),
);

assert(
  "progressive conversion no longer requires final campaign confirmation",
  /create or replace function public\._cr_classify_unit_conversion_v1[\s\S]*v_campaign\.status not in \('open', 'review', 'confirmed'\)/.test(
    progressiveSql,
  ) &&
    /create or replace function public\.convert_community_registration_unit_to_activation_v1[\s\S]*v_campaign\.status not in \('open', 'review', 'confirmed'\)/.test(
      progressiveSql,
    ) &&
    !/mark_community_registration_campaign_processed_v1\(/.test(actions) &&
    !/confirm_community_registration_campaign_v1\(/.test(actions),
);

const classifierFunction =
  progressiveSql.match(
    /create or replace function public\._cr_classify_unit_conversion_v1[\s\S]*?\$function\$;/,
  )?.[0] ?? "";

assert(
  "progressive classifier keeps UUID-safe queue candidate selection",
  /v_campaign\.status not in \('open', 'review', 'confirmed'\)/.test(
    classifierFunction,
  ) &&
    /with matching_queue as/.test(classifierFunction) &&
    /queue_count as/.test(classifierFunction) &&
    /queue_candidate as/.test(classifierFunction) &&
    /order by id[\s\S]*limit 1/.test(classifierFunction) &&
    !/\b(min|max)\s*\(\s*q\.id\s*\)/i.test(classifierFunction),
);

assert(
  "runtime hotfix is the same focused classifier replacement",
  runtimeHotfixSql.trim().endsWith(classifierFunction.trim()) &&
    !/record_community_registration_unit_external_approval_v1|convert_community_registration_unit_to_activation_v1/.test(
      runtimeHotfixSql,
    ),
);

assert(
  "other unregistered units remain valid public participants",
  /resolve_community_registration_campaign_v1[\s\S]*v_campaign\.status <> 'open'/.test(
    backendSql,
  ) &&
    /lookup_community_registration_unit_v1[\s\S]*and c\.status = 'open'/.test(
      backendSql,
    ) &&
    /submit_community_registration_household_v1[\s\S]*v_campaign\.status <> 'open'/.test(
      backendSql,
    ) &&
    /mark_community_registration_unit_reviewed_v1[\s\S]*v_campaign\.status not in \('open', 'review'\)/.test(
      progressiveSql,
    ),
);

assert(
  "retry remains idempotent and stale or correction states remain blocked",
  /if v_unit\.status = 'processed'[\s\S]*already_confirmed/.test(progressiveSql) &&
    /if v_unit\.status = 'confirmed'[\s\S]*already_confirmed/.test(
      progressiveSql,
    ) &&
    /v_unit\.status = 'processed'[\s\S]*already_complete/.test(progressiveSql) &&
    /decision = 'correction_requested'[\s\S]*ENTRY_CR_CORRECTION_REQUIRED/.test(
      progressiveSql,
    ) &&
    /version_number > v_submission\.version_number/.test(progressiveSql) &&
    /token_type = 'resident_edit'[\s\S]*status = 'active'/.test(progressiveSql),
);

assert(
  "legacy campaign closeout remains confirmed-unit based follow-up after all units processed",
  /create or replace function public\.confirm_community_registration_campaign_v1/.test(
    reviewSql,
  ) &&
    /count\(\*\) filter \(where status = 'confirmed'\)::integer/.test(
      reviewSql,
    ) &&
    /if v_confirmed_units = 0 then[\s\S]*ENTRY_CR_REVIEW_NOT_READY/.test(
      reviewSql,
    ) &&
    !/confirm_community_registration_campaign_v1/.test(progressiveSql),
);

assert(
  "ONB-004 activation queue writer is preserved through the versioned replacement",
  /create or replace function public\.convert_community_registration_unit_to_activation_v1/.test(
    conversionSql + progressiveSql,
  ) &&
    /insert into public\.resident_activation_queue/.test(progressiveSql) &&
    /Does not create PINs or users/.test(progressiveSql),
);

console.log("ENTRY-ONB-012 review to activation handoff validation passed.");
