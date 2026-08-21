import fs from "node:fs";

const migrationPath =
  "supabase/migrations/20260817040516_create_entry_community_registration_review_ui_hardening_v1.sql";
const resubmitHotfixPath =
  "supabase/migrations/20260817043002_fix_cr_resubmit_resolves_pending_correction.sql";
const actionPath = "features/entry/communityRegistration/review/actions.ts";
const queryPath = "features/entry/communityRegistration/review/queries.ts";
const workspacePath =
  "features/entry/communityRegistration/review/ReviewWorkspace.tsx";
const routePath =
  "app/(console)/products/entry/communities/[communityId]/registration/page.tsx";
const cardPath =
  "features/entry/communityRegistration/admin/CommunityRegistrationCard.tsx";
const gatewayPath =
  "features/entry/communityRegistration/public/gateway.ts";
const correctionPagePath =
  "app/(public)/entry/register/[slug]/correct/page.tsx";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function functionBody(sql, functionName) {
  const pattern = new RegExp(
    `create or replace function public\\.${functionName}[\\s\\S]*?\\$function\\$;`,
    "i",
  );
  return sql.match(pattern)?.[0] ?? "";
}

function assert(name, ok) {
  if (!ok) throw new Error(name);
  console.log(`PASS ${name}`);
}

const migration = read(migrationPath);
const resubmitHotfix = read(resubmitHotfixPath);
const actions = read(actionPath);
const queries = read(queryPath);
const workspace = read(workspacePath);
const route = read(routePath);
const card = read(cardPath);
const gateway = read(gatewayPath);
const correctionPage = read(correctionPagePath);
const rotateEdit = functionBody(
  migration,
  "rotate_community_registration_edit_access_v1",
);
const resolveEdit = functionBody(
  migration,
  "resolve_community_registration_edit_v1",
);
const resubmit = functionBody(
  resubmitHotfix,
  "resubmit_community_registration_household_v1",
);

assert("forward-only ONB-008 hardening migration exists", migration.length > 0);
assert("forward-only ONB-008 resubmit hotfix exists", resubmitHotfix.length > 0);

assert(
  "review workspace is reachable from Community Registration card",
  /Review registrations/.test(card) &&
    /\/products\/entry\/communities\/\$\{communityId\}\/registration/.test(card) &&
    /submittedUnitCount > 0/.test(card),
);

assert(
  "review route loads existing approved review RPC-backed queries",
  /getCommunityRegistrationReviewOverview/.test(route) &&
    /getCommunityRegistrationReviewUnit/.test(route) &&
    /get_community_registration_review_summary_v1/.test(queries) &&
    /list_community_registration_review_units_v1/.test(queries) &&
    /get_community_registration_review_unit_v1/.test(queries),
);

assert(
  "review mutations remain superadmin-gated server actions",
  /requireSuperadmin\(\)/.test(actions) &&
    /start_community_registration_review_v1/.test(actions) &&
    /mark_community_registration_unit_reviewed_v1/.test(actions) &&
    /request_community_registration_correction_v1/.test(actions),
);

assert(
  "UI supports progressive unit review without campaign-wide start-review CTA",
  !/StartReviewDialog|showStartReview|setShowStartReview|canStartReview/.test(
    workspace,
  ) &&
    !/Start review|Starting review|Start internal review|campaign-wide review/.test(
      workspace,
    ) &&
    /campaignStatus === "open"/.test(workspace) &&
    /reviewCapable = \["open", "review"\]\.includes\(campaignStatus\)/.test(
      workspace,
    ) &&
    /reviewCapable && selectedStatus === "submitted"/.test(workspace) &&
    /Mark reviewed/.test(workspace),
);

assert(
  "correction request requires bounded operator observation",
  /name="observation"/.test(workspace) &&
    /maxLength=\{1000\}/.test(workspace) &&
    /observation\.length > 1000/.test(actions) &&
    /request_community_registration_correction_v1/.test(actions),
);

assert(
  "correction capability plaintext is generated server-side and only hash reaches Supabase",
  /randomBytes\(32\)\.toString\("base64url"\)/.test(actions) &&
    /hashCorrectionToken\(plaintextToken\)/.test(actions) &&
    /p_edit_token_hash: editTokenHash/.test(actions) &&
    !/p_edit_token_hash:\s*plaintextToken/.test(actions),
);

assert(
  "first correction link reuses approved enable-edit backend",
  /enable_community_registration_edit_v1/.test(actions) &&
    /p_campaign_unit_id: campaignUnitId/.test(actions) &&
    /p_expires_at: expiresAt/.test(actions),
);

assert(
  "replacement correction link uses dedicated rotation RPC",
  /rotate_community_registration_edit_access_v1/.test(actions) &&
    /mode === "replace"/.test(actions) &&
    /Replace correction link/.test(workspace),
);

assert(
  "rotation RPC only permits existing edit-enabled household",
  /v_unit\.status <> 'edit_enabled'/.test(rotateEdit) &&
    /status = 'edit_enabled'/.test(rotateEdit) &&
    /ENTRY_CR_INVALID_STATE/.test(rotateEdit),
);

assert(
  "rotation locks campaign unit and submission before token replacement",
  /from public\.community_registration_campaigns[\s\S]*for update/i.test(rotateEdit) &&
    /from public\.community_registration_units[\s\S]*for update/i.test(rotateEdit) &&
    /from public\.community_registration_submissions[\s\S]*for update/i.test(rotateEdit) &&
    rotateEdit.indexOf("for update") <
      rotateEdit.indexOf("update public.community_registration_access_tokens"),
);

assert(
  "rotation revokes active resident edit access then inserts replacement atomically",
  /token_type = 'resident_edit'[\s\S]*status = 'active'/.test(rotateEdit) &&
    /set status = 'revoked'[\s\S]*revoked_at = now\(\)/.test(rotateEdit) &&
    /insert into public\.community_registration_access_tokens/.test(rotateEdit) &&
    /'resident_edit'/.test(rotateEdit) &&
    !/\bexception\b/i.test(rotateEdit),
);

assert(
  "rotation emits replacement audit event without token material",
  /'resident_edit_access_replaced'/.test(rotateEdit) &&
    /'revoked_previous_count', v_revoked_count/.test(rotateEdit) &&
    !/'token_hash'|'plaintext'/.test(
      rotateEdit.match(/return jsonb_build_object\([\s\S]*?\);/i)?.[0] ?? "",
    ),
);

assert(
  "rotation RPC is service-role-only and unavailable to public roles",
  /_cr_service_role_only_v1\(\)/.test(rotateEdit) &&
    /revoke all on function public\.rotate_community_registration_edit_access_v1\(uuid, text, timestamptz, uuid, text\) from public/.test(migration) &&
    /revoke all on function public\.rotate_community_registration_edit_access_v1\(uuid, text, timestamptz, uuid, text\) from anon/.test(migration) &&
    /revoke all on function public\.rotate_community_registration_edit_access_v1\(uuid, text, timestamptz, uuid, text\) from authenticated/.test(migration) &&
    /grant execute on function public\.rotate_community_registration_edit_access_v1\(uuid, text, timestamptz, uuid, text\) to service_role/.test(migration),
);

assert(
  "current correction observation is scoped to same authorized unit and submission",
  /campaign_unit_id = v_unit\.id/.test(resolveEdit) &&
    /submission_id = v_submission\.id/.test(resolveEdit) &&
    /decision = 'correction_requested'/.test(resolveEdit) &&
    /is_current/.test(resolveEdit) &&
    /resolution_status = 'pending'/.test(resolveEdit) &&
    /'correction_observation', v_correction_observation/.test(resolveEdit),
);

assert(
  "authorized public gateway maps correction observation",
  /correction_observation\?: string \| null/.test(gateway) &&
    /correctionObservation = result\.correction_observation\?\.trim\(\) \|\| null/.test(gateway) &&
    /correctionObservation,/.test(gateway),
);

assert(
  "resident correction page visibly explains requested correction",
  /correction\.correctionObservation/.test(correctionPage) &&
    /Observación de la administración/.test(correctionPage),
);

assert(
  "successful resubmit resolves current correction inside the same transaction",
  /_cr_replace_current_review_v1\(v_unit\.id\)/.test(resubmit) &&
    resubmit.indexOf("_cr_replace_current_review_v1(v_unit.id)") <
      resubmit.indexOf("update public.community_registration_access_tokens") &&
    !/\bexception\b/i.test(resubmit),
);

assert(
  "resubmit hotfix repairs stale pending corrections only when a newer submission exists",
  /decision = 'correction_requested'/.test(resubmitHotfix) &&
    /resolution_status = 'pending'/.test(resubmitHotfix) &&
    /newer_submission\.version_number > reviewed_submission\.version_number/.test(resubmitHotfix) &&
    /resolution_status = 'resolved'/.test(resubmitHotfix),
);

assert(
  "resubmit remains service-role-only after hotfix",
  /_cr_service_role_only_v1\(\)/.test(resubmit) &&
    /revoke all on function public\.resubmit_community_registration_household_v1\(text, jsonb\) from public/.test(resubmitHotfix) &&
    /revoke all on function public\.resubmit_community_registration_household_v1\(text, jsonb\) from anon/.test(resubmitHotfix) &&
    /revoke all on function public\.resubmit_community_registration_household_v1\(text, jsonb\) from authenticated/.test(resubmitHotfix) &&
    /grant execute on function public\.resubmit_community_registration_household_v1\(text, jsonb\) to service_role/.test(resubmitHotfix),
);

assert(
  "no admin plaintext correction capability persistence or logging",
  !/localStorage|sessionStorage|cookies\.set|console\.(log|info|warn|error|debug)/.test(
    `${actions}\n${workspace}`,
  ),
);

assert(
  "ONB-008 does not introduce ENTRY mobile dependencies",
  !/entry-mobile|expo-router|react-native|app\/\(tabs\)/i.test(
    `${migration}\n${resubmitHotfix}\n${actions}\n${queries}\n${workspace}\n${route}`,
  ),
);
