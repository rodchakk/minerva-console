import assert from "node:assert/strict";
import { test } from "node:test";
import {
  validCatalog, watchEntries, currentlyTrackedFinding, toOsvFinding, toNvdFindings, toProviderAdvisoryFindings, deduplicate, withinWindow, cvss3BaseScore, cvssSeverity, osvPriority, matchesSimpleVersionRange, validIngestionAcknowledgement
} from "../scripts/security-watch-core.mjs";
import catalog from "../security-watch/catalog.json" with { type: "json" };

test("catalog is manual, finite and product ownership is preserved", () => {
  validCatalog(catalog);
  const entries = watchEntries(catalog);
  const next = entries.find((x) => x.package === "next" && x.version === "16.4.5");
  assert.ok(next);
  assert.deepEqual(next.products.map((p) => p.id).sort(), ["entry", "minerva-console"]);
  const entryWeb = catalog.products.find((x) => x.id === "entry-web");
  assert.equal(entryWeb.environment, "legacy");
  assert.equal(entryWeb.enabled, false);
  assert.equal(entries.some((x) => x.products.some((p) => p.id === "entry-web")), false);
  assert.equal(entries.some((e) => e.products.some((p) => p.id === "brother-system")), false);
});

test("legacy exclusion and read-time reconciliation leave historical scans immutable", () => {
  const live = watchEntries(catalog);
  const oldVersion = {
    technology: "Next.js", version: "16.4.1",
    products: [{ id: "entry", name: "ENTRY", team: "ENTRY Team" }]
  };
  assert.equal(currentlyTrackedFinding(oldVersion, catalog), null);
  const oldEntryWeb = {
    technology: "Next.js", version: "16.2.3",
    products: [{ id: "entry-web", name: "ENTRY Web", team: "ENTRY Team" }]
  };
  assert.equal(currentlyTrackedFinding(oldEntryWeb, catalog), null);
  const shared = {
    technology: "Next.js", version: "16.4.5",
    products: [
      { id: "entry", name: "ENTRY", team: "ENTRY Team" },
      { id: "entry-web", name: "ENTRY Web", team: "ENTRY Team" }
    ]
  };
  const result = currentlyTrackedFinding(shared, catalog);
  assert.deepEqual(result.products.map((x) => x.id), ["entry"]);
  assert.equal(shared.products.length, 2, "stored original must stay unchanged");
  const vendor = {
    technology: "Supabase", version: "managed",
    products: [{ id: "entry", name: "ENTRY", team: "ENTRY Team" },
      { id: "seshat", name: "Seshat", team: "Seshat Team" }]
  };
  assert.deepEqual(currentlyTrackedFinding(vendor, catalog).products.map((x) => x.id), ["entry", "seshat"]);
  assert.equal(live.some((x) => x.version === "16.2.3"), false);
  const invalid = structuredClone(catalog);
  invalid.products.find((x) => x.id === "entry-web").enabled = true;
  assert.throws(() => validCatalog(invalid), /Legacy products cannot be actively monitored/);
});

test("reject invalid OSV range, duplicate product and unknown technology", () => {
  const input = structuredClone(catalog);
  input.products[0].technologies[0].version = "^16";
  assert.throws(() => validCatalog(input), /exact version/);
  const duplicate = structuredClone(catalog);
  duplicate.products[1].id = duplicate.products[0].id;
  assert.throws(() => validCatalog(duplicate), /duplicate/);
  const unknown = structuredClone(catalog);
  unknown.products[0].technologies[0].kind = "powershell";
  assert.throws(() => validCatalog(unknown), /Unsupported/);
});

test("OSV is a version match, not confirmed exploitation; withdrawn records excluded", () => {
  const entry = watchEntries(catalog).find((x) => x.package === "next" && x.version === "16.4.5");
  const advisory = { id: "GHSA-abc1-efg2-abcd", summary: "Public notice", published: "2026-11-08T01:00:00Z", database_specific: { severity: "HIGH" } };
  const finding = toOsvFinding(advisory, entry);
  assert.equal(finding.confidence, "VERSION_MATCH");
  assert.equal(finding.severity, "HIGH");
  assert.equal(finding.source, "osv");
  assert.ok(finding.url.startsWith("https://osv.dev/"));
  assert.equal(toOsvFinding({ ...advisory, withdrawn: "2026-11-08T02:00:00Z" }, entry), null);
  assert.equal(withinWindow(finding, Date.parse("2026-11-07T00:00:00Z")), true);
  assert.equal(withinWindow(finding, Date.parse("2026-11-09T00:00:00Z")), false);
});

test("NVD requires structured product identifiers, not incidental keyword mentions", () => {
  const base = {
    id: "CVE-2026-12345",
    descriptions: [{ lang: "en", value: "An application built with Node.js is vulnerable" }],
    published: "2026-11-08T06:00:00Z",
    metrics: { cvssMetricV31: [{ cvssData: { baseSeverity: "CRITICAL" } }] }
  };
  const entries = watchEntries(catalog);
  assert.equal(toNvdFindings(base, entries).length, 0);
  const unrelated = { ...base, configurations: [{ nodes: [{ cpeMatch: [{
    vulnerable: true, criteria: "cpe:2.3:a:unrelated:server:1.0:*:*:*:*:*:*:*"
  }] }] }] };
  assert.equal(toNvdFindings(unrelated, entries).length, 0);
  const actual = { ...base, configurations: [{ nodes: [{ cpeMatch: [{
    vulnerable: true, criteria: "cpe:2.3:a:nodejs:node.js:*:*:*:*:*:*:*:*"
  }] }] }] };
  const matches = toNvdFindings(actual, entries);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].confidence, "CPE_PRODUCT");
  assert.equal(matches[0].severity, "CRITICAL");
  assert.deepEqual(matches[0].products.map((x) => x.id).sort(),
    ["entry", "minerva-console", "minerva-webpage"]);
});

test("duplicate advisories only render once per fingerprint", () => {
  const entry = watchEntries(catalog).find((x) => x.package === "next" && x.version === "16.4.5");
  const f = toOsvFinding({ id: "GHSA-aaaa-bbbb-cccc", summary: "Example", published: "2026-11-08T01:00:00Z" }, entry);
  assert.equal(deduplicate([f, f]).length, 1);
  assert.deepEqual(deduplicate([f, f])[0].products.map((x) => x.id).sort(), ["entry", "minerva-console"]);
});

test("official Supabase vendor advisories match registered provider, never confirm hosted exposure", () => {
  const entries = watchEntries(catalog);
  const vuln = {
    ghsa_id: "GHSA-fgvp-cqg6-q8h2",
    summary: "Supabase Storage provider bulletin",
    description: "Public advisory about Storage RLS",
    severity: "critical",
    published_at: "2026-11-06T12:00:00Z",
    updated_at: "2026-11-06T13:00:00Z"
  };
  const result = toProviderAdvisoryFindings(vuln, "supabase/storage", entries);
  assert.equal(result.length, 1);
  assert.equal(result[0].source, "github");
  assert.equal(result[0].severity, "CRITICAL");
  assert.equal(result[0].confidence, "VENDOR_NOTICE");
  assert.deepEqual(result[0].products.map((p) => p.id), ["entry", "seshat"]);
  assert.equal(toProviderAdvisoryFindings({ ...vuln, withdrawn_at: "2026-11-08T01:00:00Z" }, "supabase/storage", entries).length, 0);
});

test("CVSS 3.1 vector severity is interpreted without guessing unsupported formats", () => {
  const vector = "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H";
  assert.equal(cvss3BaseScore(vector), 9.8);
  assert.equal(cvssSeverity(cvss3BaseScore(vector)), "CRITICAL");
  assert.equal(osvPriority({ severity: [{ type: "CVSS_V3", score: vector }] }), "CRITICAL");
  assert.equal(cvss3BaseScore("CVSS:4.0/AV:N/AC:L"), null);
  assert.equal(cvss3BaseScore("garbage"), null);
});

test("official Next.js advisories are mapped only to affected catalog version branches", () => {
  const advisory = {
    ghsa_id: "GHSA-pc58-hwjq-p385",
    summary: "Next.js security notice",
    description: "A version-dependent issue in Next.js",
    published_at: "2026-11-03T12:00:00Z",
    updated_at: "2026-11-03T12:00:00Z",
    severity: "moderate",
    vulnerabilities: [
      { package: { ecosystem: "npm", name: "next" },
        vulnerable_version_range: ">= 16.0.0, <= 16.4.4", patched_versions: "16.4.5" },
      { package: { ecosystem: "npm", name: "next" },
        vulnerable_version_range: "<= 15.5.28", patched_versions: "15.5.29" }
    ]
  };
  const matches = toProviderAdvisoryFindings(advisory, "vercel/next.js", watchEntries(catalog));
  assert.equal(matches.length, 0);
  assert.deepEqual(matches.map((x) => x.version).sort(), []);
  assert.ok(matches.every((f) => f.confidence === "VENDOR_NOTICE" && f.severity === "MEDIUM"));
  assert.equal(matches.some((f) => f.products?.some((p) => ["entry", "minerva-console", "minerva-webpage"].includes(p.id))), false);
  assert.equal(matchesSimpleVersionRange("16.4.5", ">= 16.0.0, <= 16.4.4"), false);
  assert.equal(matchesSimpleVersionRange("16.4.1", ">= 16.0.0, <= 16.4.4"), true);
});

test("scheduler never mistakes a login page or inconclusive response for saved scan", () => {
  assert.equal(validIngestionAcknowledgement(null), null);
  assert.equal(validIngestionAcknowledgement({ ok: false, status: "ok", findings: 2 }), false);
  assert.equal(validIngestionAcknowledgement({ ok: true, status: "failed", findings: 2,
    notifications: "none", duplicate: false }), false);
  assert.equal(validIngestionAcknowledgement({ ok: true, status: "ok", findings: 3,
    notifications: "sent", duplicate: false }), true);
  assert.equal(validIngestionAcknowledgement({ ok: true, status: "partial", findings: 1,
    notifications: "none", duplicate: true }), true);
});
