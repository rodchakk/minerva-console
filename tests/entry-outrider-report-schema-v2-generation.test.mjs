import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();
const migration = readFileSync(
  join(
    root,
    "supabase/migrations/20260915150000_outrider_setup_report_v2_generation.sql",
  ),
  "utf8",
);
const model = readFileSync(
  join(root, "features/entry/outrider/setupReport/model.ts"),
  "utf8",
);

function functionBody(source, functionName) {
  const start = source.indexOf(`create or replace function public.${functionName}`);
  assert.notEqual(start, -1, `Expected SQL function body for ${functionName}`);
  const afterStart = source.slice(start);
  const endMarker = "$function$;";
  const end = afterStart.indexOf(endMarker);
  assert.notEqual(end, -1, `Expected SQL function terminator for ${functionName}`);
  return afterStart.slice(0, end + endMarker.length);
}

test("database report reservation accepts the current v2 report schema", () => {
  const prepare = functionBody(
    migration,
    "prepare_community_outrider_setup_report_v1",
  );

  assert.match(
    model,
    /SETUP_REPORT_SCHEMA_VERSION\s*=\s*"entry-outrider-setup-report-v2"/,
  );
  assert.match(
    prepare,
    /p_report_schema_version <> 'entry-outrider-setup-report-v2'/,
  );
  assert.doesNotMatch(
    prepare,
    /p_report_schema_version <> 'entry-outrider-setup-report-v1'/,
  );
});

test("v2 reservation preserves workbook, fingerprint, finding, and version guards", () => {
  const prepare = functionBody(
    migration,
    "prepare_community_outrider_setup_report_v1",
  );

  assert.match(prepare, /p_workbook_schema_version <> 'entry-onboarding-workbook-v1'/);
  assert.match(prepare, /p_source_sha256 is distinct from v_source\.file_sha256/);
  assert.match(prepare, /jsonb_typeof\(p_findings\) <> 'array'/);
  assert.match(prepare, /where f->>'severity' = 'error'/);
  assert.match(prepare, /coalesce\(max\(version\), 0\) \+ 1/);
  assert.match(prepare, /status = 'generating'/);
  assert.match(prepare, /ENTRY_OUTRIDER_SETUP_REPORT_GENERATION_IN_PROGRESS/);
  assert.match(prepare, /to service_role/);
});
