import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [route, summary, followUpMigration, diagnosticMigration] = await Promise.all([
  readFile("app/api/entry/observability/diagnostic/route.ts", "utf8"),
  readFile("features/entry/observability/DiagnosticBundleControl.tsx", "utf8"),
  readFile("supabase/migrations/20260927054000_entry_activation_follow_up_buckets.sql", "utf8"),
  readFile("supabase/migrations/20260919075037_entry_diagnostic_truth_hardening.sql", "utf8"),
]);

test("Infrastructure queue excludes pin_generated; follow-up includes it", () => {
  assert.match(diagnosticMigration, /'activation', jsonb_build_object\([\s\S]*?q\.status in \('pending','invited'\)/);
  assert.match(followUpMigration, /'open_count', count\(\*\) filter \([\s\S]*?q\.status in \('pending', 'pin_generated', 'invited'\)/);
});

test("Diagnostic enrichment never overwrites canonical activation open_count", () => {
  assert.match(route, /open_count: followUpOpenCount/);
  assert.match(route, /oldest_open_at: followUpOldestOpenAt/);
  assert.match(route, /\.\.\.followUpRest/);
  assert.match(route, /follow_up_open_count: followUpOpenCount/);
  assert.match(route, /follow_up_oldest_open_at: followUpOldestOpenAt/);
  assert.doesNotMatch(route, /\.\.\.\(followUpSummary as Record<string, unknown>\)/);
});

test("Export labels current and historical health separately and exposes both activation counts", () => {
  assert.match(summary, /Current health \(latest\):/);
  assert.match(summary, /Selected-window health:/);
  assert.match(summary, /Infrastructure activation queue \(pending\/invited\):/);
  assert.match(summary, /Activation follow-up \(pending\/invited\/PIN-generated\):/);
  assert.match(summary, /Historical failure signals in selected window:/);
});
