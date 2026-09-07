import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");

const form = read("features/entry/outrider/public/OutriderPublicForm.tsx");
const model = read("features/entry/outrider/model.ts");
const gateway = read("features/entry/outrider/public/gateway.ts");
const queries = read("features/entry/outrider/queries.ts");
const exportBuilder = read("features/entry/outrider/export.ts");
const detailPage = read(
  "app/(console)/products/entry/outrider/[outriderId]/page.tsx",
);
const adminSummary = read(
  "features/entry/outrider/internal/OutriderInitialAdminsSummary.tsx",
);
const migration = read(
  "supabase/migrations/20260907071000_outrider_initial_administrators.sql",
);

test("destination copy describes businesses and service points instead of common areas", () => {
  assert.match(form, /comercios, talleres, pulperías, oficinas u otros lugares/);
  assert.match(form, /Taller El Trancazo/);
  assert.match(form, /Pulpería Don Juan/);
  assert.doesNotMatch(
    form,
    /¿Existen áreas comunes, recreativas u otros lugares que deban aparecer como destinos en ENTRY\?/,
  );
});

test("initial administrator intake captures count, person, unit and practical contact channel", () => {
  assert.match(form, /¿Cuántos administradores habrá al iniciar\?/);
  assert.match(form, /Nombre completo/);
  assert.match(form, /Casa o unidad/);
  assert.match(form, /Teléfono/);
  assert.match(form, /Correo electrónico/);
  assert.match(model, /initialAdminCount: number \| null/);
  assert.match(model, /initialAdmins: OutriderAdministrator\[\]/);
  assert.match(model, /administrator\.unit/);
  assert.match(model, /draft\.initialAdmins\.length === draft\.initialAdminCount/);
});

test("gateway persists and resolves initial administrator fields", () => {
  assert.match(gateway, /initial_admin_count: normalized\.initialAdminCount/);
  assert.match(gateway, /initial_admins: normalized\.initialAdmins/);
  assert.match(gateway, /initialAdminCount: asNullableInteger\(outrider\.initial_admin_count\)/);
  assert.match(gateway, /initialAdmins: asAdministrators\(outrider\.initial_admins\)/);
});

test("database keeps initial admins in Outrider only and requires them before submit", () => {
  assert.match(migration, /add column if not exists initial_admin_count integer/);
  assert.match(migration, /add column if not exists initial_admins jsonb/);
  assert.match(migration, /_outrider_initial_admins_complete_v1/);
  assert.match(migration, /ENTRY_OUTRIDER_INCOMPLETE/);
  assert.match(migration, /initial_admin_count = v_count/);
  assert.match(migration, /initial_admins = v_admins/);

  for (const table of [
    "houses",
    "community_users",
    "guards",
    "community_destinations",
    "activation_queue",
  ]) {
    assert.doesNotMatch(
      migration,
      new RegExp(`\\b(insert into|update|delete from)\\s+public\\.${table}\\b`, "i"),
    );
  }
});

test("internal review and exports expose administrators for activation preparation", () => {
  assert.match(queries, /initialAdminCount: nullableInteger\(row\.initial_admin_count\)/);
  assert.match(queries, /initialAdmins: administratorArray\(row\.initial_admins\)/);
  assert.match(exportBuilder, /administrators:/);
  assert.match(exportBuilder, /people: detail\.initialAdmins/);
  assert.match(exportBuilder, /## Initial Administrators/);
  assert.match(detailPage, /OutriderInitialAdminsSummary/);
  assert.match(adminSummary, /Administradores iniciales/);
  assert.match(adminSummary, /Unidad:/);
});
