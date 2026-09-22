import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

test("Resident Registration opens as a Pending-first operational queue", () => {
  const source = read(
    "features/entry/communityRegistration/review/ReviewWorkspace.tsx",
  );

  assert.match(source, /useState<UnitFilter>\("pending"\)/);
  assert.match(
    source,
    /\["pending", "Pending"\][\s\S]*\["duplicates", "Duplicates"\][\s\S]*\["reviewed", "Patronato"\][\s\S]*\["activation", "Activation"\][\s\S]*\["all", "All"\][\s\S]*\["resolved", "Resolved"\]/,
  );
  assert.match(source, /Search unit, resident, email or phone/);
});

test("selected unit separates duplicate alert from activation status", () => {
  const source = read(
    "features/entry/communityRegistration/review/ReviewWorkspace.tsx",
  );

  assert.match(source, /Duplicate alert/);
  assert.match(source, /Possible duplicate found/);
  assert.match(source, /Compare & review/);
  assert.match(source, /Mark not duplicate/);
  assert.match(source, /Activation status/);
  assert.match(source, /Open Activation Queue/);
});

test("resolved duplicate history stays distinct from a real merge", () => {
  const source = read(
    "features/entry/communityRegistration/review/duplicateQueries.ts",
  );
  const workspace = read(
    "features/entry/communityRegistration/review/ReviewWorkspace.tsx",
  );
  const migration = read(
    "supabase/migrations/20260922023000_entry_registration_duplicate_resolution.sql",
  );

  assert.match(source, /resolutionType: "merged" \| "resolved_duplicate" \| null/);
  assert.match(source, /resolvedUnitIds/);
  assert.match(workspace, /Resolved duplicate/);
  assert.match(workspace, /Related registrations/);
  assert.match(migration, /resolution_type\s*=\s*'resolved_duplicate'\s+is (?:the )?authoritative/i);
});

test("duplicate matcher keeps shared family contacts conservative", () => {
  const source = read(
    "features/entry/communityRegistration/review/duplicateQueries.ts",
  );

  assert.match(source, /A shared family email by itself is not enough/);
  assert.match(source, /Shared email only; not enough to merge residents/);
  assert.match(source, /Shared phone only; not enough to merge residents/);
  assert.match(source, /Compatible names share a phone; operator must confirm/);
});

test("Herberth and Herbert style tiny-name variants require both contacts", () => {
  const source = read(
    "features/entry/communityRegistration/review/duplicateQueries.ts",
  );

  assert.match(source, /function isTinyNameVariant/);
  assert.match(source, /\(expandedName \|\| tinyNameVariant\) && sameEmail && samePhone/);
  assert.match(source, /near-identical names with the same email and phone/);
});

test("dialog switches between merge, archive, and manual identity review", () => {
  const source = read(
    "features/entry/communityRegistration/review/DuplicateReviewDialog.tsx",
  );

  assert.match(source, /Compare & resolve household/);
  assert.match(source, /const resolveMode/);
  assert.match(source, /const manualIdentityReview/);
  assert.match(source, /Archive duplicate/);
  assert.match(source, /Resolve duplicate/);
  assert.match(source, /Manual identity review required/);
  assert.match(source, /Merge units/);
});

test("advanced canonical resolution preserves unique information for review", () => {
  const source = read(
    "features/entry/communityRegistration/review/DuplicateReviewDialog.tsx",
  );

  assert.match(source, /Unique information found in/);
  assert.match(source, /uniqueDataAcknowledged/);
  assert.match(source, /Preserve it in archived/);
  assert.match(source, /operational household will not be changed/);
});

test("merge backend derives truth from source residents rather than client result fields", () => {
  const migration = read(
    "supabase/migrations/20260922023000_entry_registration_duplicate_resolution.sql",
  );

  assert.match(migration, /server_resolved_plan/);
  assert.match(migration, /client_resident_plan/);
  assert.match(migration, /ENTRY_CR_DUPLICATE_RESIDENT_UNRESOLVED/);
  assert.match(migration, /ENTRY_CR_DUPLICATE_RESIDENT_CONFLICT/);
  assert.match(
    migration,
    /ENTRY_CR_DUPLICATE_RESIDENT_FIELD_CONFLICT_UNRESOLVED/,
  );
  assert.match(migration, /v_email_choice not in \('canonical', 'duplicate'\)/);
  assert.match(migration, /v_phone_choice not in \('canonical', 'duplicate'\)/);
  assert.match(
    migration,
    /when v_email_choice = 'duplicate' then v_resident\.email/,
  );
  assert.match(
    migration,
    /when v_phone_choice = 'duplicate' then v_resident\.phone/,
  );
  assert.doesNotMatch(
    migration,
    /v_result_email := nullif\(btrim\(coalesce\(v_plan_decision->>'resultEmail'/,
  );
});

test("tampered resident ids are rejected by the merge RPC", () => {
  const migration = read(
    "supabase/migrations/20260922023000_entry_registration_duplicate_resolution.sql",
  );

  assert.match(
    migration,
    /duplicate_resident\.submission_id = v_duplicate_submission\.id/,
  );
  assert.match(
    migration,
    /canonical_resident\.submission_id = v_canonical_submission\.id/,
  );
  assert.match(migration, /ENTRY_CR_DUPLICATE_RESIDENT_PLAN_REQUIRED/);
});

test("resolve duplicate backend never rewrites operational identity tables", () => {
  const migration = read(
    "supabase/migrations/20260922023000_entry_registration_duplicate_resolution.sql",
  );
  const start = migration.indexOf(
    "create or replace function public.resolve_community_registration_archived_duplicate_v1",
  );
  assert.ok(start >= 0);
  const resolveSource = migration.slice(start);

  assert.match(resolveSource, /resolution_type/);
  assert.match(resolveSource, /'resolved_duplicate'/);
  assert.match(resolveSource, /ENTRY_CR_DUPLICATE_MANUAL_IDENTITY_REVIEW_REQUIRED/);
  assert.match(resolveSource, /ENTRY_CR_DUPLICATE_UNIQUE_DATA_REVIEW_REQUIRED/);
  assert.match(resolveSource, /update public\.community_registration_units/);
  assert.doesNotMatch(resolveSource, /update auth\.users/);
  assert.doesNotMatch(resolveSource, /update public\.resident_activation_queue/);
  assert.doesNotMatch(resolveSource, /update public\.houses/);
  assert.doesNotMatch(resolveSource, /update public\.house_residents/);
});

test("duplicate mutations remain behind Preview read-only boundary", () => {
  const source = read(
    "features/entry/communityRegistration/review/duplicateActions.ts",
  );

  assert.match(source, /getEntryPreviewReadOnlyError/);
  assert.match(source, /merge_community_registration_units_v1/);
  assert.match(source, /resolve_community_registration_archived_duplicate_v1/);
  assert.match(source, /resolve_community_registration_duplicate_v1/);
});


test("resident contact conflicts expose source-only choices and keep-separate escape hatch", () => {
  const source = read(
    "features/entry/communityRegistration/review/DuplicateReviewDialog.tsx",
  );

  assert.match(source, /Choose which contact value to keep/);
  assert.match(source, /Email conflict/);
  assert.match(source, /Phone conflict/);
  assert.match(source, /Keep from \{label\}/);
  assert.match(source, /Keep residents separate/);
  assert.match(source, /emailChoice: conflictChoices/);
  assert.match(source, /phoneChoice: conflictChoices/);
  assert.match(source, /unresolvedCount \+ conflictCount/);
});

test("server only accepts canonical or duplicate source for conflicting contact fields", () => {
  const migration = read(
    "supabase/migrations/20260922023000_entry_registration_duplicate_resolution.sql",
  );

  assert.match(
    migration,
    /v_email_choice not in \('canonical', 'duplicate'\)/,
  );
  assert.match(
    migration,
    /v_phone_choice not in \('canonical', 'duplicate'\)/,
  );
  assert.match(
    migration,
    /'email_choice', v_email_choice/,
  );
  assert.match(
    migration,
    /'phone_choice', v_phone_choice/,
  );
  assert.doesNotMatch(
    migration,
    /v_result_email := .*resultEmail/,
  );
  assert.doesNotMatch(
    migration,
    /v_result_phone := .*resultPhone/,
  );
});


test("shared contacts inside one household are surfaced without becoming duplicate matches", () => {
  const workspace = read(
    "features/entry/communityRegistration/review/ReviewWorkspace.tsx",
  );

  assert.match(workspace, /function getSharedContactIssues/);
  assert.match(workspace, /Shared email/);
  assert.match(workspace, /Shared phone/);
  assert.match(workspace, /Shared contact review/);
  assert.match(workspace, /This does not mean they are the same person/);
  assert.match(workspace, /separate ENTRY accounts cannot share the same email identity/);
  assert.match(workspace, /data-testid="shared-contact-warning"/);
});

test("shared contact warnings stay separate from duplicate candidate logic", () => {
  const workspace = read(
    "features/entry/communityRegistration/review/ReviewWorkspace.tsx",
  );
  const duplicateSource = read(
    "features/entry/communityRegistration/review/duplicateQueries.ts",
  );

  assert.match(workspace, /sharedContactIssuesByUnitId/);
  assert.match(workspace, /hasSharedEmail/);
  assert.match(workspace, /hasSharedPhone/);
  assert.match(duplicateSource, /A shared family email by itself is not enough/);
  assert.match(duplicateSource, /Shared email only; not enough to merge residents/);
});


test("Resident Registration builds WhatsApp follow-up from resident-actionable diagnostics", () => {
  const workspace = read(
    "features/entry/communityRegistration/review/ReviewWorkspace.tsx",
  );
  const page = read(
    "app/(console)/products/entry/communities/[communityId]/registration/page.tsx",
  );

  assert.match(workspace, /function buildResidentContactItems/);
  assert.match(workspace, /function buildResidentContactMessage/);
  assert.match(workspace, /Referencia o ubicación de la vivienda/);
  assert.match(workspace, /correo electrónico válido/);
  assert.match(workspace, /número de teléfono/);
  assert.match(workspace, /Confirmar correo electrónico de/);
  assert.match(workspace, /Confirmar número de teléfono de/);
  assert.match(workspace, /Este es un mensaje generado por ENTRY/);
  assert.match(workspace, /Vivienda: \${input\.unitLabel}/);
  assert.match(workspace, /ENTRY by Minerva Technologies/);
  assert.match(page, /communityName=\{community\.name\}/);
});

test("WhatsApp follow-up remains operator-controlled and excludes internal diagnostics", () => {
  const workspace = read(
    "features/entry/communityRegistration/review/ReviewWorkspace.tsx",
  );

  assert.match(workspace, /https:\/\/wa\.me\//);
  assert.match(workspace, /encodeURIComponent\(\s*residentContactMessage/);
  assert.match(workspace, /Open WhatsApp/);
  assert.match(workspace, /Copy message/);
  assert.match(workspace, /Generated only from resident-actionable diagnostics/);
  assert.match(workspace, /Internal duplicate and workflow signals are never included/);

  const messageBuilderStart = workspace.indexOf("function buildResidentContactMessage");
  const messageBuilderEnd = workspace.indexOf("function normalizeWhatsAppNumber");
  assert.ok(messageBuilderStart >= 0 && messageBuilderEnd > messageBuilderStart);
  const messageBuilder = workspace.slice(messageBuilderStart, messageBuilderEnd);
  assert.doesNotMatch(messageBuilder, /Possible duplicate|Patronato|Activation Queue/);
});

test("WhatsApp normalizer adds Honduras country code to local eight-digit numbers", () => {
  const workspace = read(
    "features/entry/communityRegistration/review/ReviewWorkspace.tsx",
  );

  assert.match(workspace, /if \(digits\.length === 8\) digits = `504\${digits}`/);
  assert.match(workspace, /digits\.length >= 8 && digits\.length <= 15/);
  assert.match(workspace, /No usable phone is registered/);
});
