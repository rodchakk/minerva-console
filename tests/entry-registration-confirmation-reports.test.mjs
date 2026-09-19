import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

test("confirmation reports share one completeness helper for screen and report data", () => {
  const completeness = read(
    "features/entry/communityRegistration/review/completeness.ts",
  );
  const queries = read(
    "features/entry/communityRegistration/review/queries.ts",
  );
  const workspace = read(
    "features/entry/communityRegistration/review/ReviewWorkspace.tsx",
  );

  assert.match(completeness, /getResidentMissingFields/);
  assert.match(completeness, /getUnitMissingFields/);
  assert.match(completeness, /"email"/);
  assert.match(completeness, /"phone"/);
  assert.match(completeness, /"full_name"/);
  assert.match(completeness, /"unit_reference"/);
  assert.match(queries, /getUnitMissingFields/);
  assert.match(workspace, /getResidentCompletenessStatus/);
  assert.match(workspace, /getUnitMissingFields/);
});

test("report query reuses the existing registration review RPC and never mutates workflow state", () => {
  const queries = read(
    "features/entry/communityRegistration/review/queries.ts",
  );
  const action = read(
    "features/entry/communityRegistration/review/reportActions.ts",
  );

  assert.match(queries, /get_community_registration_review_unit_v1/);
  assert.match(queries, /community_registration_units/);
  assert.match(queries, /unit_reference_snapshot/);
  assert.match(queries, /requireSuperadmin\(\)/);
  assert.doesNotMatch(action, /mark_community_registration_unit_reviewed_v1/);
  assert.doesNotMatch(action, /record_community_registration_unit_external_approval_v1/);
  assert.doesNotMatch(action, /convert_community_registration_unit_to_activation_v1/);
  assert.doesNotMatch(action, /\.insert\(|\.update\(|\.upsert\(|\.delete\(/);
});

test("registration review exposes stable master-detail selection and report preview", () => {
  const workspace = read(
    "features/entry/communityRegistration/review/ReviewWorkspace.tsx",
  );
  const page = read(
    "app/(console)/products/entry/communities/[communityId]/registration/page.tsx",
  );

  assert.match(workspace, /type="checkbox"/);
  assert.match(workspace, /Generar informe/);
  assert.match(workspace, /correos faltantes/);
  assert.match(workspace, /Datos faltantes/);
  assert.match(workspace, /ConfirmationReportDrawer/);
  assert.match(workspace, /loadCommunityRegistrationConfirmationReport/);
  assert.match(workspace, /Seleccionar todas/);
  assert.match(workspace, /sessionStorage/);
  assert.match(workspace, /scroll=\{false\}/);
  assert.match(workspace, /detailPending/);
  assert.match(workspace, /Buscar vivienda/);
  assert.match(workspace, /Abierta/);
  assert.match(workspace, /100dvh/);
  assert.match(workspace, /scrollbar-gutter:stable/);
  assert.equal(workspace.match(/overflow-y-auto overscroll-contain/g)?.length, 2);
  assert.doesNotMatch(workspace, /xl:min-h-\[620px\]/);
  assert.doesNotMatch(page, /selectedUnit && selectedUnitReference/);
  assert.doesNotMatch(workspace, /Generar informe de selección/);
});

test("preview is deterministic DOM output with PNG and PDF export", () => {
  const drawer = read(
    "features/entry/communityRegistration/review/ConfirmationReportDrawer.tsx",
  );

  assert.match(drawer, /Revisión de residentes/);
  assert.match(drawer, /por confirmar/);
  assert.match(drawer, /By Minerva/);
  assert.match(drawer, /Gestión de residentes/);
  assert.match(drawer, /Comunidades/);
  assert.match(drawer, /más conectadas/);
  assert.match(drawer, /para un mejor mañana/);
  assert.match(drawer, /icon=\{House\}/);
  assert.match(drawer, /icon=\{Users\}/);
  assert.match(drawer, /icon=\{ClipboardList\}/);
  assert.match(drawer, /Referencia pendiente/);
  assert.match(drawer, /Titular/);
  assert.match(drawer, /Resumen de datos pendientes/);
  assert.match(drawer, /Todos los datos requeridos están completos/);
  assert.match(drawer, /ENTRY \| MINERVA/);
  assert.match(drawer, /Unidades fuertes/);
  assert.match(drawer, /html-to-image/);
  assert.match(drawer, /pdf-lib/);
  assert.match(drawer, /Exportar PNG/);
  assert.match(drawer, /Exportar PDF/);
  assert.match(drawer, /ref=\{reportRef\}/);
  assert.match(drawer, /renderNodeToPng\(node\)/);
  assert.doesNotMatch(drawer, /openai|image_gen|generative ai/i);
});

test("activation handoff warns about missing email without disabling complete residents", () => {
  const workspace = read(
    "features/entry/communityRegistration/review/ReviewWorkspace.tsx",
  );

  assert.match(workspace, /Correo pendiente:/);
  assert.match(workspace, /no podrán recibir una invitación por correo/);
  assert.match(workspace, /emailWarningNames/);
  assert.doesNotMatch(
    workspace,
    /disabled=\{emailWarningNames\.length > 0\}/,
  );
});
