import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

test("Field header exposes compact ENTRY health beside QR and timer", () => {
  const shell = read("components/field/FieldShell.tsx");
  const indicator = read(
    "features/entry/field/FieldEntryHealthIndicator.tsx",
  );

  assert.match(shell, /FieldActiveWorkTimerIndicator/);
  assert.match(shell, /FieldEntryHealthIndicator/);
  assert.match(indicator, /href="\/field\/entry\/health"/);
  assert.match(indicator, /Activity/);
  assert.match(indicator, /Healthy/);
  assert.match(indicator, /Degraded/);
  assert.match(indicator, /Down/);
});

test("Field health reuses the hardened ENTRY observability source and fails open", () => {
  const layout = read("app/(field)/field/layout.tsx");
  const queries = read("features/entry/observability/queries.ts");

  assert.match(layout, /getEntryObservability\(\{ range: "24h" \}\)/);
  assert.match(layout, /\.catch\(\(\) => \(\{/);
  assert.match(layout, /entryHealthStatus/);
  assert.match(layout, /entryIncidentCount/);
  assert.match(queries, /sa_get_entry_observability_v5/);
});

test("Field health route derives last fully healthy from real health evidence", () => {
  const page = read("app/(field)/field/entry/health/page.tsx");

  assert.match(page, /getEntryObservability\(\{ range: "24h" \}\)/);
  assert.match(page, /getEntryDiagnosticSnapshots\(\{ limit: 50 \}\)/);
  assert.match(page, /currentStatus === "healthy"/);
  assert.match(page, /snapshot\.systemStatus === "healthy"/);
  assert.match(page, /FieldEntryHealthWorkspace/);
});

test("Field health stays compact while copying the complete web diagnostic bundle", () => {
  const workspace = read(
    "features/entry/field/FieldEntryHealthWorkspace.tsx",
  );

  assert.match(
    workspace,
    /fetch\("\/api\/entry\/observability\/diagnostic"/,
  );
  assert.match(workspace, /30 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(workspace, /diagnosticInspection\(payload\.bundle\)/);
  assert.match(workspace, /JSON\.stringify\(bundle, null, 2\)/);
  assert.match(workspace, /copyText\(inspection\.json\)/);
  assert.match(workspace, /Diagnostic copied/);
  assert.match(workspace, /raw JSON is\s+not displayed in Field/i);
  assert.match(workspace, /DIAGNOSTIC_REQUIRED_SECTIONS/);
  assert.match(workspace, /schema_version/);
  assert.match(workspace, /current_observability/);
  assert.match(workspace, /current_incidents/);
  assert.match(workspace, /historical_failure_signals/);
  assert.match(workspace, /queue_health/);
  assert.match(workspace, /privacy\.pii_minimized !== true/);
  assert.match(workspace, /Diagnostic bundle is incomplete/);
  assert.match(workspace, /Nothing was copied/);
  assert.match(workspace, /formatDiagnosticSize/);
  assert.match(workspace, /sections · complete/);
  assert.doesNotMatch(workspace, /<pre/);
  assert.doesNotMatch(workspace, /JSON\.stringify\(payload\.bundle, null, 2\)\}/);
});

test("Field health presents operational flows, real latency percentiles, incidents and affected areas", () => {
  const workspace = read(
    "features/entry/field/FieldEntryHealthWorkspace.tsx",
  );

  assert.match(workspace, /Critical flows/);
  assert.match(workspace, /operational/);
  assert.match(workspace, /p50/);
  assert.match(workspace, /p95/);
  assert.match(workspace, /p99/);
  assert.match(workspace, /Incidents/);
  assert.match(workspace, /Affected area/);
  assert.match(workspace, /incident\.explanation/);
  assert.match(workspace, /No critical flow impact/);
});
