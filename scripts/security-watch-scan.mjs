#!/usr/bin/env node
// Minerva Security Watch: public-advisory radar only. NEVER reads product code, data or servers.
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import {
  deduplicate, toNvdFindings, toOsvFinding, toProviderAdvisoryFindings, validCatalog, watchEntries, withinWindow, validIngestionAcknowledgement
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
  const keywords = [...new Set(entries.filter((x) => x.kind === "keyword")
    .filter((x) => x.nvdCpe).map((x) => x.keyword).filter(Boolean))];
  if (!keywords.length) return [];
  const start = new Date(sinceMs).toISOString();
  const end = now.toISOString();
  const results = [];
  let requests = 0;

  // Request ONLY cataloged technologies, not the entire NVD modified-CVE firehose.
  // NVD's no-key API has a 5 requests/30s shared-IP quota, so stagger requests.
  for (const keyword of keywords) {
    let offset = 0;
    for (let page = 0; page < 3; page++) {
      if (requests++ > 0) await new Promise((resolve) => setTimeout(resolve, 7500));
      const url = new URL(NVD);
      url.searchParams.set("keywordSearch", keyword);
      url.searchParams.set("lastModStartDate", start);
      url.searchParams.set("lastModEndDate", end);
      url.searchParams.set("startIndex", String(offset));
      url.searchParams.set("resultsPerPage", "2000");
      const data = await jsonRequest(url.toString(),
        { headers: { "user-agent": "Minerva-Security-Watch/1.0" } }, 45000);
      if (!Array.isArray(data.vulnerabilities) ||
          !Number.isInteger(data.totalResults) || data.totalResults < 0) {
        throw new Error("NVD response shape mismatch for " + keyword);
      }
      for (const item of data.vulnerabilities) {
        const publication = Date.parse(item.cve?.published || "");
        if (!Number.isFinite(publication) || publication < sinceMs - 30 * 86400_000) continue;
        results.push(...toNvdFindings(item.cve, entries));
      }
      offset += data.vulnerabilities.length;
      if (offset >= data.totalResults) break;
      if (data.vulnerabilities.length === 0 || page === 2) {
        throw new Error("NVD keyword pagination incomplete for " + keyword);
      }
    }
  }
  return results;
}

async function vendorAdvisoryScan(entries) {
  if (!entries.some((entry) => ["Supabase", "Next.js", "Node.js"].includes(entry.name))) return [];
  const repos = ["supabase/storage", "supabase/auth", "supabase/realtime",
    "vercel/next.js", "nodejs/node"];
  const findings = [];
  for (const repository of repos) {
    const url = "https://api.github.com/repos/" + repository + "/security-advisories?per_page=100";
    const advisories = await jsonRequest(url, {
      headers: {
        "accept": "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        "user-agent": "Minerva-Security-Watch/1.0"
      }
    });
    if (!Array.isArray(advisories)) throw new Error("Vendor security advisory feed format mismatch");
    for (const advisory of advisories) {
      for (const finding of toProviderAdvisoryFindings(advisory, repository, entries)) {
        if (withinWindow(finding, sinceMs)) findings.push(finding);
      }
    }
  }
  return findings;
}

async function main() {
  const raw = await readFile(new URL("../security-watch/catalog.json", import.meta.url), "utf8");
  const catalog = validCatalog(JSON.parse(raw));
  const entries = watchEntries(catalog);
  const sources = {};
  const findings = [];
  for (const [name, scan] of [["osv", osvScan], ["nvd", nvdScan], ["github", vendorAdvisoryScan]]) {
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
    if (Object.values(sources).every((x) => !x.ok)) throw new Error("All advisory providers failed");
    return;
  }
  if (process.env.GITHUB_REPOSITORY !== "rodchakk/minerva-console" ||
      process.env.GITHUB_REF !== "refs/heads/master") {
    throw new Error("Automated ingestion requires the trusted default branch");
  }
  const identityEndpoint = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const identityRequestToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if (!identityEndpoint || !identityRequestToken ||
      !identityEndpoint.startsWith("https://")) {
    throw new Error("GitHub Actions OIDC identity is unavailable");
  }
  const identityUrl = identityEndpoint +
    (identityEndpoint.includes("?") ? "&" : "?") +
    "audience=minerva-security-watch-ingest-v1";
  const identity = await jsonRequest(identityUrl, {
    headers: { authorization: "Bearer " + identityRequestToken }
  }, 10000);
  if (typeof identity.value !== "string" || identity.value.length < 100) {
    throw new Error("GitHub Actions did not issue a valid identity token");
  }
  const endpoint = "https://console.minervatechs.com/api/security-watch/ingest";
  const response = await fetch(endpoint, {
    method: "POST",
    redirect: "manual", // Do not mistake an auth redirect to HTML /login for success.
    headers: { "content-type": "application/json", authorization: "Bearer " + identity.value },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(25000)
  });
  if (!response.ok) throw new Error("Security Watch ingestion returned HTTP " + response.status);
  if (!response.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    throw new Error("Security Watch endpoint did not return JSON acknowledgement");
  }
  let acknowledgement;
  try { acknowledgement = await response.json(); }
  catch { throw new Error("Security Watch ingestion returned invalid JSON"); }
  if (!validIngestionAcknowledgement(acknowledgement)) {
    throw new Error("Security Watch did not acknowledge a recorded scan");
  }
  console.log("Security Watch verified ingestion: " + acknowledgement.findings +
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
