import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BACKUP_CRON, LOOKBACK_MS, requiresBackupCheck,
  recentlyVerifiedRun, shouldScan
} from "../scripts/security-watch-schedule-guard.mjs";

const NOW = Date.parse("2026-11-09T12:47:00.000Z");
const run = (patch = {}) => ({
  id: 10, status: "completed", conclusion: "success", event: "schedule",
  head_branch: "master", updated_at: new Date(NOW - 30 * 60_000).toISOString(),
  ...patch
});
const ctx = { event: "schedule", cron: BACKUP_CRON, currentRunId: "30",
  repository: "rodchakk/minerva-console", token: "synthetic-fixture-only", nowMs: NOW };

test("primary, manual and push events always scan without GitHub API", async () => {
  for (const [event, cron] of [
    ["schedule", "17 0,12 * * *"], ["workflow_dispatch", ""], ["push", ""]
  ]) {
    const result = await shouldScan({ ...ctx, event, cron, fetcher: () => { throw Error("unexpected fetch"); } });
    assert.equal(result.scan, true);
  }
  assert.equal(requiresBackupCheck("schedule", BACKUP_CRON), true);
  assert.equal(requiresBackupCheck("workflow_dispatch", BACKUP_CRON), false);
});

test("backup skips only when a completed success exists on master in last 75 minutes", () => {
  assert.equal(recentlyVerifiedRun([run()], NOW, 30)?.id, 10);
  assert.equal(recentlyVerifiedRun([run({ conclusion: "failure" })], NOW, 30), null);
  assert.equal(recentlyVerifiedRun([run({ head_branch: "feature" })], NOW, 30), null);
  assert.equal(recentlyVerifiedRun([run({ id: 30 })], NOW, 30), null);
  assert.equal(recentlyVerifiedRun([run({ status: "in_progress" })], NOW, 30), null);
  assert.equal(recentlyVerifiedRun([run({ updated_at: new Date(NOW - LOOKBACK_MS - 1000).toISOString() })], NOW, 30), null);
  assert.equal(recentlyVerifiedRun([run({ updated_at: new Date(NOW + 3600000).toISOString() })], NOW, 30), null);
});

test("backup skips when a successful scheduled, manual or push verified ingestion is recent", async () => {
  for (const event of ["schedule", "push", "workflow_dispatch"]) {
    const result = await shouldScan({ ...ctx, fetcher: async () => ({
      ok: true, json: async () => ({ workflow_runs: [run({ event })] })
    }) });
    assert.equal(result.scan, false, event);
  }
});

test("missing, failed or stale previous runs activate the backup", async () => {
  for (const fixtures of [
    [], [run({ conclusion: "failure" })],
    [run({ updated_at: new Date(NOW - LOOKBACK_MS - 1000).toISOString() })],
    [run({ event: "pull_request" })]
  ]) {
    const result = await shouldScan({ ...ctx, fetcher: async () => ({
      ok: true, json: async () => ({ workflow_runs: fixtures })
    }) });
    assert.equal(result.scan, true);
  }
});

test("API failures and missing credentials fail open, never silence the backup", async () => {
  const noToken = await shouldScan({ ...ctx, token: "" });
  assert.equal(noToken.scan, true);
  const apiDown = await shouldScan({ ...ctx, fetcher: async () => ({
    ok: false, status: 503
  }) });
  assert.equal(apiDown.scan, true);
  const badShape = await shouldScan({ ...ctx, fetcher: async () => ({
    ok: true, json: async () => ({ unrelated: true })
  }) });
  assert.equal(badShape.scan, true);
});

test("unknown schedule or repository does not suppress the scanner", async () => {
  const mismatch = await shouldScan({ ...ctx, repository: "another/repo" });
  assert.equal(mismatch.scan, true);
  assert.equal(recentlyVerifiedRun(null, NOW, 30), null);
});
