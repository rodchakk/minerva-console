import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();
const migration = readFileSync(
  join(
    root,
    "supabase/migrations/20260915053000_outrider_setup_report_final_hardening.sql",
  ),
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

test("setup workflow state errors use a non-conflict SQLSTATE", () => {
  const raiseHelper = functionBody(migration, "_outrider_raise_v1");

  for (const code of [
    "ENTRY_OUTRIDER_SETUP_REPORT_REQUIRED",
    "ENTRY_OUTRIDER_SETUP_REPORT_STALE",
    "ENTRY_OUTRIDER_SETUP_WORKBOOK_STALE",
    "ENTRY_OUTRIDER_BLOCKING_FINDINGS",
    "ENTRY_OUTRIDER_REPORT_UNAVAILABLE",
    "ENTRY_OUTRIDER_APPROVED_LOCKED",
    "ENTRY_OUTRIDER_SETUP_REPORT_GENERATION_IN_PROGRESS",
  ]) {
    assert.match(raiseHelper, new RegExp(code));
  }

  assert.match(raiseHelper, /v_sqlstate := 'P0412'/);
  assert.match(raiseHelper, /raise exception '%'[\s\S]*errcode = v_sqlstate/);
});

test("setup report approval is idempotent only while the approved report is still current and fresh", () => {
  const approval = functionBody(
    migration,
    "approve_community_outrider_setup_report_v1",
  );

  assert.match(approval, /v_report\.status not in \('draft', 'approved'\)/);
  assert.match(approval, /v_latest_source_id is distinct from v_report\.source_file_id/);
  assert.match(approval, /v_report\.input_sha256 is distinct from p_current_input_sha256/);
  assert.match(approval, /ENTRY_OUTRIDER_SETUP_REPORT_STALE/);
  assert.match(
    approval,
    /if v_report\.status = 'approved' then[\s\S]*'idempotent', true[\s\S]*return/,
  );
  assert.match(
    approval,
    /update public\.community_outrider_setup_reports[\s\S]*set status = 'approved'[\s\S]*and status = 'draft'/,
  );
  assert.match(approval, /'setup_report_approved'/);
  assert.match(approval, /'idempotent', false/);
});
