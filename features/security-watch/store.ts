import "server-only";

import { Redis } from "@upstash/redis";
import { Resend } from "resend";
import { formatDiagnosis, type SecurityFinding, type SecurityScan, type StoredScan } from "./model";

const CURRENT_KEY = "minerva:security-watch:v1:latest";
const NOTIFIED_KEY = "minerva:security-watch:v1:emailed-keys";
const HISTORY_KEY = "minerva:security-watch:v1:recent-runs";
const RETAIN_DAYS = 60;

function redisClient() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error("Security Watch storage is not configured");
  }
  return Redis.fromEnv();
}

export async function readSecurityWatchState(): Promise<{
  state: StoredScan | null;
  error: string | null;
  recent: Array<{ runId: string; checkedAt: string; status: string; findings: number }>;
  overdue: boolean;
}> {
  try {
    const redis = redisClient();
    const [state, runs] = await Promise.all([
      redis.get<StoredScan>(CURRENT_KEY),
      redis.lrange<{ runId: string; checkedAt: string; status: string; findings: number }>(HISTORY_KEY, 0, 7)
    ]);
    const checkedAt = Date.parse(state?.checkedAt ?? "");
    const overdue = !Number.isFinite(checkedAt) ||
      Date.now() - checkedAt > 36 * 3600000;
    return { state: state || null, error: null, recent: runs || [], overdue };
  } catch {
    return { state: null, error: "Security Watch storage is unavailable.", recent: [], overdue: true };
  }
}

function collectFindings(current: SecurityScan, previous: StoredScan | null) {
  const now = Date.parse(current.checkedAt);
  const latest = new Map<string, SecurityFinding>();
  // A provider failure must never erase the previous findings for that provider.
  // Recent findings stay actionable between bulletin publication windows.
  for (const item of previous?.findings || []) {
    const published = Date.parse(item.publishedAt || "");
    const modified = Date.parse(item.modifiedAt || "");
    const newestPublicEvent = Math.max(
      Number.isFinite(published) ? published : 0,
      Number.isFinite(modified) ? modified : 0
    );
    if (!newestPublicEvent || now - newestPublicEvent <= RETAIN_DAYS * 86400000) {
      latest.set(item.key, item);
    }
  }
  for (const item of current.findings) latest.set(item.key, item);
  const result = [...latest.values()].sort((a, b) => {
    const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, UNKNOWN: 4 };
    return (order[a.severity] - order[b.severity]) ||
      String(b.publishedAt || "").localeCompare(String(a.publishedAt || ""));
  });
  return result.slice(0, 160);
}

function alertable(finding: SecurityFinding) {
  return finding.severity === "CRITICAL" || finding.severity === "HIGH";
}

async function emailNewFindings(findings: SecurityFinding[], checkedAt: string, sources: SecurityScan["sources"]) {
  if (!findings.length) return "none" as const;
  if (process.env.VERCEL_ENV !== "production") return "disabled_preview" as const;
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.SECURITY_WATCH_ALERT_FROM;
  const recipients = process.env.SECURITY_WATCH_ALERT_TO;
  if (!apiKey || !from || !recipients) return "not_configured" as const;
  const to = recipients.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 5);
  if (!to.length) return "not_configured" as const;

  const report = formatDiagnosis(findings, {
    schemaVersion: 1, runId: "email", checkedAt, recordedAt: checkedAt, findings,
    sources,
    status: "partial", notification: "none"
  });
  const summary = findings.slice(0, 15).map((item) =>
    item.severity + " · " + item.technology + " · " +
    item.products.map((p) => p.name).join(", ")).join("\n");
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to,
    subject: "[Minerva Security Watch] " + findings.length + " new high-priority advisory match(es)",
    text: "Automated potential matches; impact has NOT been verified.\n\n" +
      summary + "\n\nOpen https://console.minervatechs.com/security-watch for the full table.\n\n" +
      report.slice(0, 25000)
  });
  if (error) throw new Error("Mail provider rejected the security notification");
  return "sent" as const;
}

export async function recordSecurityWatchScan(scan: SecurityScan) {
  const redis = redisClient();
  const existing = await redis.get<StoredScan>(CURRENT_KEY);
  if (existing?.runId === scan.runId ||
      (existing && Date.parse(existing.checkedAt) > Date.parse(scan.checkedAt))) {
    // A delayed/replayed workflow must never replace newer security information.
    return { duplicate: true, state: existing };
  }
  const ok = Object.values(scan.sources).filter((source) => source.ok).length;
  const status: StoredScan["status"] = ok === 3 ? "ok" : ok === 0 ? "failed" : "partial";
  const combined = collectFindings(scan, existing || null);
  const sent = new Set(await redis.smembers(NOTIFIED_KEY));
  const newAlerts = scan.findings.filter((finding) => alertable(finding) && !sent.has(finding.key));
  let notification: StoredScan["notification"] = "none";
  try {
    notification = await emailNewFindings(newAlerts, scan.checkedAt, scan.sources);
    if (notification === "sent" && newAlerts.length) {
      const [first, ...rest] = newAlerts.map((finding) => finding.key);
      if (first) await redis.sadd(NOTIFIED_KEY, first, ...rest);
    }
  } catch {
    notification = "failed";
  }
  const state: StoredScan = {
    ...scan,
    findings: combined,
    recordedAt: new Date().toISOString(),
    status,
    notification
  };
  await redis.set(CURRENT_KEY, state);
  await redis.lpush(HISTORY_KEY, {
    runId: scan.runId, checkedAt: scan.checkedAt, status, findings: combined.length
  });
  await redis.ltrim(HISTORY_KEY, 0, 19);
  return { duplicate: false, state };
}
