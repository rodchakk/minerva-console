#!/usr/bin/env node
// Minerva Security Watch: public-advisory radar only. NEVER reads product code, data or servers.
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import {
  deduplicate, toNvdFindings, toOsvFinding, validCatalog, watchEntries, withinWindow
} from "./security-watch-core.mjs";

const OSV = "https://api.osv.dev/v1";
const NVD = "https://services.nvd.nist.gov/rest/json/cves/2.0";
const LOOKBACK_DAYS = 7;
const now = new Date();
const sinceMs = now.getTime() - LOOKBACK_DAYS * 86400_000;

async function jsonRequest(url, options = {}, timeoutMs = 25000) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error("Advisory provider returned HTTP " + response.status);
  return response.json();
}

async function osvScan(entries) {
  const targets = entries.filter((x) => x.kind === "osv");
  if (!targets.length) return [];
  const findings = [];
  // Querybatch returns ID stubs; fetch each record for security details and publication date.
  for (let start = 0; start < targets.length; start += 30) {
    const segment = targets.slice(start, start + 30);
    let pending = segment.map((entry) => ({
      entry,
      query: { package: { ecosystem: entry.ecosystem, name: entry.package }, version: entry.version }
    }));
    const byEntry = new Map(segment.map((entry) => [entry.watchKey, new Set()]));
    for (let page = 0; pending.length && page < 6; page++) {
      const body = JSON.stringify({ queries: pending.map((item) => item.query) });
      const result = await jsonRequest(OSV + "/querybatch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body
      });
      if (!Array.isArray(result.results) || result.results.length !== pending.length) {
        throw new Error("OSV batch response shape mismatch");
      }
      const next = [];
      result.results.forEach((item, index) => {
        for (const vuln of item.vulns || []) {
          if (typeof vuln.id === "string") byEntry.get(pending[index].entry.watchKey).add(vuln.id);
        }
        if (item.next_page_token) {
          next.push({
            entry: pending[index].entry,
            query: { ...pending[index].query, page_token: item.next_page_token }
          });
        }
      });
      pending = next;
    }
    if (pending.length) throw new Error("OSV pagination exceeded scan safety limit");
    const index = new Map();
    for (const entry of segment) {
      for (const id of byEntry.get(entry.watchKey)) {
        if (!index.has(id)) index.set(id, []);
        index.get(id).push(entry);
      }
    }
    const allIds = [...index.keys()].slice(0, 260);
    if (index.size > allIds.length) throw new Error("OSV result volume exceeded safety limit");
    for (let i = 0; i < allIds.length; i += 8) {
      const batch = allIds.slice(i, i + 8);
      const details = await Promise.all(batch.map((id) =>
        jsonRequest(OSV + "/vulns/" + encodeURIComponent(id))));
      details.forEach((vuln, j) => {
        for (const entry of index.get(batch[j])) {
          const finding = toOsvFinding(vuln, entry);
          if (finding && withinWindow(finding, sinceMs)) findings.push(finding);
        }
      });
    }
  }
  return findings;
}

async function nvdScan(entries) {
  if (!entries.some((x) => x.kind === "keyword")) return [];
  const start = new Date(sinceMs).toISOString();
  const end = now.toISOString();
  const results = [];
  let offset = 0;
  for (let page = 0; page < 4; page++) {
    const url = new URL(NVD);
    url.searchParams.set("pubStartDate", start);
    url.searchParams.set("pubEndDate", end);
    url.searchParams.set("startIndex", String(offset));
    url.searchParams.set("resultsPerPage", "2000");
    const data = await jsonRequest(url.toString(), { headers: { "user-agent": "Minerva-Security-Watch/1.0" } }, 45000);
    if (!Array.isArray(data.vulnerabilities) || typeof data.totalResults !== "number") {
      throw new Error("NVD response shape mismatch");
    }
    for (const item of data.vulnerabilities) {
      results.push(...toNvdFindings(item.cve, entries));
    }
    offset += data.vulnerabilities.length;
    if (offset >= data.totalResults) return results;
    if (data.vulnerabilities.length === 0) throw new Error("NVD pagination stalled");
  }
  throw new Error("NVD result volume exceeded scan safety limit");
}

async function main() {
  const raw = await readFile(new URL("../security-watch/catalog.json", import.meta.url), "utf8");
  const catalog = validCatalog(JSON.parse(raw));
  const entries = watchEntries(catalog);
  const sources = {};
  const findings = [];
  for (const [name, scan] of [["osv", osvScan], ["nvd", nvdScan]]) {
    try {
      const results = await scan(entries);
      findings.push(...results);
      sources[name] = { ok: true, count: results.length };
    } catch (error) {
      sources[name] = {
        ok: false,
        // No tokens, headers, URLs with credentials or provider responses are logged.
        error: error instanceof Error ? error.message.slice(0, 140) : "Unknown provider error"
      };
    }
  }
  const payload = {
    schemaVersion: 1,
    runId: "gh-" + (process.env.GITHUB_RUN_ID || randomUUID()) + "-" + (process.env.GITHUB_RUN_ATTEMPT || "1"),
    checkedAt: now.toISOString(),
    sources,
    findings: deduplicate(findings)
  };
  if (process.env.SECURITY_WATCH_DRY_RUN === "1") {
    console.log(JSON.stringify({ ...payload, findings: payload.findings.map((x) => ({
      key: x.key, severity: x.severity, products: x.products.map((p) => p.name)
    })) }, null, 2));
    return;
  }
  const endpoint = process.env.SECURITY_WATCH_INGEST_URL;
  const token = process.env.SECURITY_WATCH_INGEST_TOKEN;
  if (!endpoint || !token || !endpoint.startsWith("https://") ||
      new URL(endpoint).pathname !== "/api/security-watch/ingest") {
    throw new Error("Security Watch ingestion endpoint or secret not configured");
  }
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + token },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(25000)
  });
  if (!response.ok) throw new Error("Security Watch ingestion returned HTTP " + response.status);
  console.log("Security Watch recorded: " + payload.findings.length +
    " public notices; provider status: " +
    Object.entries(sources).map(([name, value]) => name + "=" + (value.ok ? "ok" : "failed")).join(", "));
  if (Object.values(sources).every((status) => !status.ok)) {
    throw new Error("All advisory providers failed; scan not verified");
  }
}

main().catch((error) => {
  console.error("[security-watch] " + (error instanceof Error ? error.message : "Scan failed"));
  process.exitCode = 1;
});
