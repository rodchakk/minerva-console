import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { join } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

const migration = [
  read("supabase/migrations/20260907010000_entry_outrider_v1.sql"),
  read("supabase/migrations/20260907013000_entry_outrider_review_fixes.sql"),
  read("supabase/migrations/20260907014000_entry_outrider_optional_files.sql"),
  read("supabase/migrations/20260907015000_entry_outrider_export_bucket.sql"),
  read("supabase/migrations/20260907061021_outrider_standalone_intakes.sql"),
  read("supabase/migrations/20260907064847_outrider_qa_hardening.sql"),
].join("\n");
const reviewMigration = read(
  "supabase/migrations/20260907013000_entry_outrider_review_fixes.sql",
);
const qaMigration = read(
  "supabase/migrations/20260907064847_outrider_qa_hardening.sql",
);
const exportBucketMigration = read(
  "supabase/migrations/20260907015000_entry_outrider_export_bucket.sql",
);
const model = read("features/entry/outrider/model.ts");
const operationsPage = read("app/(console)/products/entry/page.tsx");
const publicPage = read("app/(public)/entry/outrider/[token]/page.tsx");
const publicForm = read("features/entry/outrider/public/OutriderPublicForm.tsx");
const optionalFilesRoute = read(
  "app/(public)/entry/outrider/[token]/available-information/complete/route.ts",
);
const publicGateway = read("features/entry/outrider/public/gateway.ts");
const publicSaveRoute = read("app/(public)/entry/outrider/[token]/save/route.ts");
const publicSubmitRoute = read("app/(public)/entry/outrider/[token]/submit/route.ts");
const uploadStartRoute = read("app/(public)/entry/outrider/[token]/upload/start/route.ts");
const uploadCompleteRoute = read(
  "app/(public)/entry/outrider/[token]/upload/complete/route.ts",
);
const packageRoute = read(
  "app/(console)/products/entry/outrider/[outriderId]/export/package/route.ts",
);
const exportBuilder = read("features/entry/outrider/export.ts");
const detailWorkspace = read(
  "features/entry/outrider/internal/OutriderDetailWorkspace.tsx",
);
const workspace = read("features/entry/outrider/internal/OutriderWorkspace.tsx");
const queries = read("features/entry/outrider/queries.ts");
const actions = read("features/entry/outrider/actions.ts");
const middleware = read("lib/supabase/middleware.ts");

test("Outrider has deterministic five-section progress semantics", () => {
  assert.match(model, /OUTRIDER_SECTIONS\s*=\s*\[/);
  for (const section of [
    "units",
    "destinations",
    "inactive_units",
    "available_information",
    "contact",
  ]) {
    assert.match(model, new RegExp(`"${section}"`));
    assert.match(migration, new RegExp(`'${section}'`));
  }
  assert.match(model, /completedCount \/ OUTRIDER_SECTIONS\.length/);
  assert.match(migration, /cardinality\(v_outrider\.completed_sections\) \* 20/);
});

test("Outrider status transitions are explicit and terminal approval is read-only", () => {
  for (const status of [
    "not_started",
    "in_progress",
    "ready_for_review",
    "needs_information",
    "approved",
  ]) {
    assert.match(migration, new RegExp(`'${status}'`));
    assert.match(model, new RegExp(`"${status}"`));
  }
  assert.match(migration, /status = 'ready_for_review'/);
  assert.match(migration, /status = 'needs_information'/);
  assert.match(migration, /status = 'approved'/);
  assert.match(migration, /v_outrider\.status in \('ready_for_review', 'approved'\)/);
  assert.match(model, /"not_started", "in_progress", "needs_information"/);
  assert.match(
    detailWorkspace,
    /const canRequestInfo = detail\.status === "ready_for_review";/,
  );
  assert.match(detailWorkspace, /canRotate=\{detail\.status !== "approved"\}/);
  assert.match(detailWorkspace, /\{canRotate \? \(/);
});

test("public routes reject invalid tokens and protect mutations", () => {
  assert.match(middleware, /pathname\.startsWith\("\/entry\/outrider\/"\)/);
  assert.match(publicGateway, /return \{ available: false \}/);
  assert.match(publicSaveRoute, /hasOutriderSameOriginBoundary/);
  assert.match(publicSubmitRoute, /hasOutriderSameOriginBoundary/);
  assert.match(uploadStartRoute, /hasOutriderSameOriginBoundary/);
  assert.match(optionalFilesRoute, /hasOutriderSameOriginBoundary/);
  assert.match(publicSaveRoute, /enforceOutriderRateLimit/);
  assert.match(publicSubmitRoute, /enforceOutriderRateLimit/);
  assert.match(uploadStartRoute, /enforceOutriderRateLimit/);
  assert.match(optionalFilesRoute, /enforceOutriderRateLimit/);
});

test("section four uses structured security staffing while files remain optional", () => {
  assert.doesNotMatch(publicPage, /OutriderOptionalFilesAcknowledge/);
  assert.match(model, /draft\.securityStaffCount !== null/);
  assert.match(publicForm, /Cantidad de personal de seguridad/);
  assert.match(publicForm, /Nombres, turnos u otra información \(opcional\)/);
  assert.match(publicForm, /El archivo es opcional/);
  assert.match(model, /OUTRIDER_PUBLIC_UPLOAD_CATEGORIES = \["community_data"\]/);
  assert.match(uploadStartRoute, /isOutriderPublicUploadCategory/);
  assert.match(uploadCompleteRoute, /isOutriderPublicUploadCategory/);
  assert.doesNotMatch(publicForm, /Listado de personal de seguridad/);
  assert.doesNotMatch(publicForm, /Listado de áreas comunes o recreativas/);
});

test("selecting Otro is a valid incomplete draft instead of a persistence error", () => {
  assert.match(
    qaMigration,
    /drop constraint if exists community_outrider_sessions_other_requires_value/,
  );
  assert.match(
    qaMigration,
    /'otro' <> all\(coalesce\(p_unit_types, '\{\}'::text\[\]\)\)[\s\S]*p_unit_type_other/,
  );
  assert.match(model, /!draft\.unitTypes\.includes\("otro"\) \|\| Boolean\(draft\.otherUnitType\)/);
});

test("draft autosave tolerates partial email but submit keeps strict validation", () => {
  assert.match(qaMigration, /Draft autosave must tolerate a partially typed email/);
  assert.match(qaMigration, /if v_contact_email is not null and length\(v_contact_email\) > 254/);
  assert.match(
    qaMigration,
    /submit_community_outrider_v1[\s\S]*contact_email !~ '\^\[\^@\\s\]\+@/,
  );
});

test("successful submit preserves completed sections and 100 percent progress", () => {
  assert.match(
    reviewMigration,
    /'completed_sections', v_outrider\.completed_sections/,
  );
  assert.match(reviewMigration, /'progress_percent', 100/);
  assert.match(
    publicGateway,
    /Array\.isArray\(result\.completed_sections\)[\s\S]*: undefined/,
  );
});

test("Outrider autosave activity is curated rather than keystroke-level", () => {
  assert.match(qaMigration, /v_previous_status = 'not_started'/);
  assert.match(
    qaMigration,
    /v_previous_completed_sections is distinct from v_completed_sections/,
  );
});

test("token material is hashed or encrypted and not exported", () => {
  assert.match(actions, /hashOutriderToken/);
  assert.match(actions, /encryptOutriderToken/);
  assert.doesNotMatch(exportBuilder, /token_hash|encrypted_token_payload|service_role/i);
  assert.match(exportBuilder, /entry-outrider-export-v1/);
});

test("canonical export includes city, security staffing and naming example without internal storage paths", () => {
  assert.match(exportBuilder, /city: detail\.communityCity/);
  assert.match(exportBuilder, /count: detail\.securityStaffCount/);
  assert.match(exportBuilder, /notes: detail\.securityStaffNotes/);
  assert.match(exportBuilder, /namingExample: detail\.unitNamingExample/);
  assert.match(exportBuilder, /Naming example:/);
  assert.doesNotMatch(exportBuilder, /storagePath: file\.storagePath/);
  assert.match(exportBuilder, /filename: file\.originalFilename/);
  assert.match(exportBuilder, /mimeType: file\.mimeType/);
});

test("ZIP packages are staged in private Storage instead of returned through Vercel", () => {
  assert.match(exportBucketMigration, /'entry-outrider-exports'/);
  assert.match(exportBucketMigration, /public,\s*file_size_limit/);
  assert.match(exportBucketMigration, /false,\s*104857600/);
  assert.match(exportBucketMigration, /'application\/zip'/);
  assert.match(exportBuilder, /OUTRIDER_EXPORT_MAX_INPUT_BYTES = 95 \* 1024 \* 1024/);
  assert.match(
    exportBuilder,
    /\.from\(OUTRIDER_EXPORT_STORAGE_BUCKET\)[\s\S]*\.upload\(storagePath, zipBytes/,
  );
  assert.match(
    exportBuilder,
    /\.createSignedUrl\(storagePath, OUTRIDER_EXPORT_SIGNED_URL_SECONDS/,
  );
  assert.match(packageRoute, /NextResponse\.redirect\(zip\.downloadUrl/);
  assert.doesNotMatch(packageRoute, /new NextResponse\(zip\.bytes/);
  assert.match(packageRoute, /package_too_large/);
});

test("payload normalization and attachment category validation are centralized", () => {
  assert.match(model, /normalizeOutriderSavePayload/);
  assert.match(model, /sanitizeOutriderFilename/);
  assert.match(model, /buildOutriderStoragePath/);
  for (const category of ["units", "residents", "security_staff", "common_areas"]) {
    assert.match(model, new RegExp(`"${category}"`));
    assert.match(migration, new RegExp(`'${category}'`));
  }
  assert.match(model, /OUTRIDER_ALLOWED_FILE_TYPES/);
  assert.match(model, /OUTRIDER_MAX_FILE_BYTES/);
  assert.match(qaMigration, /security_staff_count/);
  assert.match(qaMigration, /security_staff_notes/);
});

test("upload completion verifies the private Storage object and scoped path", () => {
  assert.match(uploadCompleteRoute, /resolvePublicOutrider/);
  assert.match(uploadCompleteRoute, /expectedPrefix = `\$\{session\.id\}\/\$\{category\}\//);
  assert.match(uploadCompleteRoute, /sanitizeOutriderFilename\(originalFilename\)/);
  assert.match(uploadCompleteRoute, /\.list\(folder,/);
  assert.match(uploadCompleteRoute, /actualByteSize !== declaredByteSize/);
  assert.match(uploadCompleteRoute, /actualMimeType !== declaredMimeType/);
  assert.match(
    reviewMigration,
    /p_storage_path not like v_outrider\.id::text \|\| '\/' \|\| p_category \|\| '\/%'/,
  );
});

test("Operations restores the original dashboard and keeps Outrider only as a quick entry plus Setup Overview", () => {
  assert.match(operationsPage, /label="Messages \(24h\)"/);
  assert.match(operationsPage, /getEntryPublishedMessagesLast24Hours/);
  assert.match(operationsPage, /Setup priorities across ENTRY/);
  assert.match(operationsPage, />Onboarding</);
  assert.match(operationsPage, /Open Activation Queue/);
  assert.match(operationsPage, /Open Outrider/);
  assert.match(operationsPage, /Setup Overview/);
  assert.match(operationsPage, /OperationalActivityFeed/);
  assert.doesNotMatch(operationsPage, /label="Outrider"/);
  assert.doesNotMatch(operationsPage, />Outrider<\/th>/);
  assert.doesNotMatch(operationsPage, /Recent Outrider activity/i);
  assert.doesNotMatch(operationsPage, /listRecentOutriderActivity/);
});

test("Outrider queue is ordered by operational priority and open excludes approved", () => {
  assert.match(queries, /ready_for_review: 0/);
  assert.match(queries, /needs_information: 1/);
  assert.match(queries, /in_progress: 2/);
  assert.match(queries, /not_started: 3/);
  assert.match(queries, /approved: 4/);
  assert.match(queries, /\.sort\(compareOperationalPriority\)/);
  assert.match(workspace, /session\.status !== "approved"/);
  assert.match(workspace, /\{ label: "Open intakes", value: openCount \}/);
});

test("Outrider events feed the existing global operational activity RPC", () => {
  assert.match(migration, /create or replace function public\.list_entry_operational_activity_v1/);
  assert.match(migration, /from public\.community_outrider_events e/);
  for (const event of [
    "outrider_started",
    "outrider_saved",
    "file_uploaded",
    "outrider_submitted",
    "information_requested",
    "outrider_approved",
  ]) {
    assert.match(migration, new RegExp(`'${event}'`));
  }
  assert.match(migration, /'Outrider'::text/);
  assert.match(migration, /'outrider'::text/);
});

test("migration security posture keeps Outrider narrow and service-role mediated", () => {
  assert.match(
    migration,
    /alter table public\.community_outrider_sessions enable row level security/,
  );
  assert.match(
    migration,
    /alter table public\.community_outrider_files enable row level security/,
  );
  assert.match(
    migration,
    /alter table public\.community_outrider_events enable row level security/,
  );
  assert.match(
    migration,
    /revoke all on table public\.community_outrider_sessions from public, anon, authenticated/,
  );
  assert.match(migration, /create or replace function public\._outrider_service_role_only_v1/);
  assert.match(
    migration,
    /grant execute on function public\.resolve_community_outrider_v1\(text\) to service_role/,
  );
  assert.match(migration, /'entry-outrider'/);
  assert.match(migration, /public = false/);
});

test("Outrider has no live ENTRY import write path", () => {
  const writableSources = [migration, actions, publicGateway, exportBuilder].join("\n");
  for (const table of [
    "houses",
    "community_users",
    "guards",
    "community_destinations",
    "activation_queue",
  ]) {
    assert.doesNotMatch(
      writableSources,
      new RegExp(`\\b(insert into|update|delete from)\\s+public\\.${table}\\b`, "i"),
    );
  }
  assert.match(
    writableSources,
    /No live ENTRY operational records are automatically imported by Outrider\./,
  );
});
