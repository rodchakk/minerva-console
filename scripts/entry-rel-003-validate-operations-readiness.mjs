import { readFileSync } from "node:fs";

const failures = [];

function read(path) {
  return readFileSync(path, "utf8");
}

function assert(name, condition) {
  if (!condition) failures.push(name);
}

const staffActions = read("features/entry/staff/actions.ts");
const staffPanel = read("features/entry/staff/StaffOperatorsPanel.tsx");
const communityQueries = read("features/entry/communities/queries.ts");
const activationActions = read("features/entry/activation/actions.ts");
const activationPage = read("app/(console)/products/entry/activation/page.tsx");
const activationReview = read(
  "features/entry/activation/ActivationQueueReviewAcknowledge.tsx",
);
const emailActions = read("features/entry/activation/emailActions.ts");
const projectsRegistry = read("content/brain/registries/projects.json");

assert(
  "guard creation accepts email or username",
  /!\(email && username\)|\(!email && !username\)/.test(staffActions) &&
    /either email or username/i.test(staffActions),
);
assert(
  "guard username normalizer is deterministic",
  /function normalizeGuardUsername/.test(staffActions) &&
    /normalize\("NFD"\)/.test(staffActions) &&
    /replace\(\/\[\^a-z0-9_\]\+\/g, "_"\)/.test(staffActions),
);
assert(
  "username-only guard uses existing synthetic-email auth pattern",
  /buildGuardSyntheticEmail\(username\)/.test(staffActions) &&
    /`guard-\$\{username\}@entry\.internal`/.test(staffActions) &&
    /email: authEmail/.test(staffActions),
);
assert(
  "username-only guard stamps existing profile identity fields",
  /auth_type:\s*"username"/.test(staffActions) &&
    /synthetic_email:\s*syntheticEmail/.test(staffActions) &&
    /username_login_enabled:\s*true/.test(staffActions),
);
assert(
  "username uniqueness produces clear operator error",
  /\.ilike\("username", username\)/.test(staffActions) &&
    /Username "\$\{username\}" is already in use/.test(staffActions),
);
assert(
  "guard creation cleanup removes profile membership and auth leftovers",
  /from\("community_members"\)[\s\S]*\.delete\(\)/.test(staffActions) &&
    /from\("profiles"\)[\s\S]*\.delete\(\)/.test(staffActions) &&
    /auth\.admin\.deleteUser/.test(staffActions),
);
assert(
  "operator UI captures username and labels email optional",
  /name="username"/.test(staffPanel) &&
    /Email optional/.test(staffPanel) &&
    /Required when no email is provided/.test(staffPanel),
);
assert(
  "operator contact hides synthetic internal email",
  /endsWith\("@entry\.internal"\)/.test(staffActions) &&
    /getPreferredContact/.test(staffActions),
);
assert(
  "community pending count uses authoritative onboarding progress",
  /extractAuthoritativeActivationPendingCount/.test(communityQueries) &&
    /activation_queue_pending/.test(communityQueries) &&
    /detail\.activationPendingCount/.test(communityQueries),
);
assert(
  "community list preserves list RPC pending count without N+1 progress fan-out",
  /list_superadmin_communities_with_progress_v1/.test(communityQueries) &&
    !/baseCommunities\.map\(async \(community\)/.test(communityQueries) &&
    !/progressResults/.test(communityQueries),
);
assert(
  "community detail combines pending and failed unresolved activations",
  /function sumPendingAndFailed/.test(communityQueries) &&
    /activation_queue_failed/.test(communityQueries) &&
    /return \(pending \?\? 0\) \+ \(failed \?\? 0\)/.test(communityQueries),
);
assert(
  "activation page exposes mark reviewed workflow",
  /ActivationQueueReviewAcknowledge/.test(activationPage) &&
    /activationQueueReviewRequired/.test(activationActions) &&
    /Mark activation queue reviewed/.test(activationReview),
);
assert(
  "activation queue acknowledgement remains community scoped",
  /markActivationQueueReviewedAction\(communityId\)/.test(activationReview) &&
    /communityId=\{selectedCommunityId\}/.test(activationPage),
);
assert(
  "successful email send sets invite_sent_at",
  /invite_sent_at:\s*inviteSentAt/.test(emailActions) &&
    /successfullyInvitedIds\.push/.test(emailActions),
);
assert(
  "activation email metadata persistence checks Supabase update errors",
  /const \{\s*error:\s*queueUpdateError\s*\} = await supabase[\s\S]*\.from\("resident_activation_queue"\)[\s\S]*\.update\(\{[\s\S]*invite_sent_at:\s*inviteSentAt[\s\S]*status:\s*"invited"[\s\S]*updated_at:\s*inviteSentAt[\s\S]*\.in\("id", successfullyInvitedIds\)/.test(
    emailActions,
  ) &&
    /if \(queueUpdateError\)/.test(emailActions),
);
assert(
  "accepted email metadata failure is reported as partial success",
  /metadata_persisted:\s*boolean/.test(emailActions) &&
    /metadataPersisted\s*=\s*false/.test(emailActions) &&
    /Email accepted by Resend, but ENTRY could not persist invite metadata/.test(
      emailActions,
    ) &&
    /item\.status === "sent"/.test(emailActions) &&
    /item\.message = metadataWarning/.test(emailActions),
);
assert(
  "metadata persistence failure logging avoids activation secrets",
  /function getSafeQueueUpdateErrorLog/.test(emailActions) &&
    /attemptedQueueCount:\s*successfullyInvitedIds\.length/.test(emailActions) &&
    !/console\.error\([\s\S]*(pin|RESEND_API_KEY|activationLink)/.test(emailActions),
);
assert(
  "resend timestamp behavior is documented",
  /Resends move invite_sent_at to the latest successful accepted delivery/.test(
    emailActions,
  ),
);
assert(
  "activation email is Spanish-first",
  /Activa tu cuenta de ENTRY/.test(emailActions) &&
    /PIN de activación/.test(emailActions) &&
    /Activar mi cuenta/.test(emailActions) &&
    /teléfono/.test(emailActions) &&
    /continúa/.test(emailActions) &&
    /contraseña/.test(emailActions) &&
    /botón/.test(emailActions) &&
    /Este PIN vence en 7 días/.test(emailActions),
);
assert(
  "activation email preserves URL PIN and rendering fields",
  /activationLink/.test(emailActions) &&
    /communityName/.test(emailActions) &&
    /residentName/.test(emailActions) &&
    /unitLabel/.test(emailActions),
);
assert(
  "future email localization remains possible",
  /locale:\s*"es"\s*=\s*"es"/.test(emailActions) &&
    /switch \(locale\)/.test(emailActions),
);
assert(
  "Brain relation target ENTRY-ONB-000 is registered",
  /"id":\s*"ENTRY-ONB-000"/.test(projectsRegistry) &&
    /entry-community-registration-foundation-contract\.md/.test(projectsRegistry),
);

if (failures.length > 0) {
  console.error("ENTRY-REL-003 operations readiness validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("ENTRY-REL-003 operations readiness validation passed.");
