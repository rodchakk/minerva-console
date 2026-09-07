import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");

const form = read("features/entry/outrider/public/OutriderPublicForm.tsx");
const model = read("features/entry/outrider/model.ts");
const migration = read(
  "supabase/migrations/20260907075500_outrider_single_source_file.sql",
);

test("public Outrider presents one generic optional source-file slot", () => {
  assert.match(
    model,
    /OUTRIDER_PUBLIC_UPLOAD_CATEGORIES = \["community_data"\] as const/,
  );
  assert.match(form, /Archivo de información de la comunidad/);
  assert.match(form, /Puede contener unidades, residentes o ambos/);
  assert.match(form, /El archivo es opcional/);
  assert.match(form, /files\.length === 0/);
  assert.match(form, /Archivo recibido/);
  assert.doesNotMatch(form, /Listado actual de residentes por unidad/);
  assert.doesNotMatch(form, /Listado de unidades o numeración de la residencial/);
});

test("database accepts the generic category while retaining legacy compatibility", () => {
  assert.match(migration, /'community_data'/);
  assert.match(migration, /'units'/);
  assert.match(migration, /'residents'/);
  assert.match(migration, /'security_staff'/);
  assert.match(migration, /'common_areas'/);
  assert.match(
    migration,
    /community_outrider_files_one_community_data_idx/,
  );
  assert.match(migration, /to service_role/);
  assert.doesNotMatch(
    migration,
    /\b(insert into|update|delete from)\s+public\.(houses|profiles|community_members|community_destinations|resident_activation_queue)\b/i,
  );
});
