#!/usr/bin/env node
// A best-effort safeguard for a missed/delayed GitHub schedule event.
// No production keys, SQL, Redis, scanning, external writes or notifications.
import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const PRIMARY_CRON = "17 0,12 * * *";
export const BACKUP_CRON = "47 0,12 * * *";
export const LOOKBACK_MS = 75 * 60 * 1000;
const REPO = "rodchakk/minerva-console";
const WORKFLOW = "security-watch.yml";
const API_URL = "https://api.github.com/repos/" + REPO +
  "/actions/workflows/" + WORKFLOW + "/runs?per_page=80&status=completed";

export function recentlyVerifiedRun(runs, nowMs, currentRunId, lookbackMs = LOOKBACK_MS) {
  if (!Array.isArray(runs) || !Number.isFinite(nowMs)) return null;
  return runs.find((run) => {
    if (!run || run.conclusion !== "success" || run.status !== "completed" ||
      run.head_branch !== "master" || String(run.id) === String(currentRunId) ||
      !["schedule", "workflow_dispatch", "push"].includes(run.event)) return false;
    const completed = Date.parse(run.updated_at || "");
    return Number.isFinite(completed) && completed <= nowMs + 60_000 &&
      nowMs - completed >= 0 && nowMs - completed <= lookbackMs;
  }) || null;
}

export function requiresBackupCheck(event, cron) {
  return event === "schedule" && cron === BACKUP_CRON;
}

async function githubCompletedRuns(token, fetcher = fetch) {
  const response = await fetcher(API_URL, {
    headers: {
      authorization: "Bearer " + token,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "Minerva-Security-Watch-Guard/1"
    },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error("GitHub read-only workflow API HTTP " + response.status);
  const data = await response.json();
  if (!Array.isArray(data.workflow_runs)) throw new Error("GitHub workflow response is invalid");
  return data.workflow_runs;
}

export async function shouldScan({ event, cron, token, nowMs = Date.now(),
  currentRunId, repository, fetcher } = {}) {
  if (!requiresBackupCheck(event, cron)) return { scan: true, reason: "primary, push or manual trigger" };
  // Never fail closed: if the API is unavailable, still perform the backup.
  if (repository !== REPO || !token) return { scan: true, reason: "API context unavailable; fail-open backup" };
  try {
    const runs = await githubCompletedRuns(token, fetcher || fetch);
    const prior = recentlyVerifiedRun(runs, nowMs, currentRunId);
    if (prior) return { scan: false, reason: "recent verified ingestion run " + prior.id };
    return { scan: true, reason: "no successful ingestion within last 75 minutes" };
  } catch {
    return { scan: true, reason: "GitHub API unavailable; fail-open backup" };
  }
}

async function main() {
  const result = await shouldScan({
    event: process.env.GITHUB_EVENT_NAME,
    cron: process.env.SECURITY_WATCH_CRON,
    repository: process.env.GITHUB_REPOSITORY,
    currentRunId: process.env.GITHUB_RUN_ID,
    token: process.env.GH_TOKEN
  });
  const outputFile = process.env.GITHUB_OUTPUT;
  if (!outputFile) throw new Error("GITHUB_OUTPUT is required");
  appendFileSync(outputFile, "should_scan=" + String(result.scan) + "\n");
  console.log("Security Watch schedule guard: " + (result.scan ? "RUN" : "SKIP") +
    " (" + result.reason + ")");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error("[security-watch-schedule-guard] " +
      (error instanceof Error ? error.message : "Unknown guard error"));
    process.exitCode = 1;
  });
}
