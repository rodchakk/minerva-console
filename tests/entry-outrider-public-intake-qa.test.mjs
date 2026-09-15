import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath =
  "supabase/migrations/20260915055000_outrider_public_intake_qa_fixes.sql";
const eventMigrationPath =
  "supabase/migrations/20260915060000_outrider_file_deleted_event.sql";
const completionFixPath =
  "supabase/migrations/20260915061000_outrider_completion_email_regex_fix.sql";
const routePath =
  "app/(public)/entry/outrider/[token]/upload/delete/route.ts";
const managerPath =
  "features/entry/outrider/public/OutriderPublicFileManager.tsx";
const pagePath = "app/(public)/entry/outrider/[token]/page.tsx";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("unit completion no longer requires the removed unit naming example", async () => {
  const sql = await source(completionFixPath);

  assert.match(sql, /create or replace function public\._outrider_complete_sections_v2/i);
  assert.doesNotMatch(
    sql,
    /nullif\(btrim\(coalesce\(p_unit_naming_example, ''\)\), ''\) is not null/i,
  );
  assert.match(sql, /cardinality\(coalesce\(p_unit_types, '\{\}'::text\[\]\)\) > 0/i);
  assert.match(sql, /'otro' <> all/i);
  assert.match(sql, /p_unit_type_other/i);
  assert.match(sql, /\[\^@\[:space:\]\]\+@\[\^@\[:space:\]\]\+/i);
});

test("public file deletion is token-scoped, editable-only, and community-data-only", async () => {
  const sql = await source(migrationPath);
  const eventSql = await source(eventMigrationPath);
  const route = await source(routePath);

  assert.match(sql, /delete_community_outrider_file_v1/i);
  assert.match(sql, /where token_hash = btrim\(coalesce\(p_token_hash, ''\)\)/i);
  assert.match(sql, /v_outrider\.status in \('ready_for_review', 'approved'\)/i);
  assert.match(sql, /and outrider_id = v_outrider\.id/i);
  assert.match(sql, /and category = 'community_data'/i);
  assert.match(sql, /'file_deleted'/i);
  assert.match(sql, /revoke all on function public\.delete_community_outrider_file_v1/i);
  assert.match(sql, /grant execute on function public\.delete_community_outrider_file_v1[\s\S]*to service_role/i);
  assert.match(eventSql, /'file_deleted'::text/i);

  assert.match(route, /hasOutriderSameOriginBoundary/);
  assert.match(route, /enforceOutriderRateLimit/);
  assert.match(route, /hashOutriderToken/);
  assert.match(route, /delete_community_outrider_file_v1/);
  assert.match(route, /OUTRIDER_STORAGE_BUCKET/);
});

test("public UI exposes a guarded delete action and remounts form after refresh", async () => {
  const manager = await source(managerPath);
  const page = await source(pagePath);

  assert.match(manager, /Eliminar archivo/);
  assert.match(manager, /window\.confirm/);
  assert.match(manager, /upload\/delete/);
  assert.match(manager, /router\.refresh\(\)/);
  assert.match(manager, /file\.category === "community_data"/);

  assert.match(page, /OutriderPublicFileManager/);
  assert.match(page, /const fileStateKey = session\.files/);
  assert.match(page, /key=\{fileStateKey\}/);
});
