import assert from "node:assert/strict";
import { test } from "node:test";
import {
  validCatalog, watchEntries, toOsvFinding, toNvdFindings, toProviderAdvisoryFindings, deduplicate, withinWindow
} from "../scripts/security-watch-core.mjs";
import catalog from "../security-watch/catalog.json" with { type: "json" };

test("catalog is manual, finite and product ownership is preserved", () => {
  validCatalog(catalog);
  const entries = watchEntries(catalog);
  const next = entries.find((x) => x.package === "next" && x.version === "16.4.1");
  assert.ok(next);
  assert.deepEqual(next.products.map((p) => p.id).sort(), ["entry", "minerva-console"]);
  assert.equal(entries.some((e) => e.products.some((p) => p.id === "brother-system")), false);
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
  const entry = watchEntries(catalog).find((x) => x.package === "next" && x.version === "16.4.1");
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

test("NVD keyword notices never claim confirmed version exposure", () => {
  const cve = { id: "CVE-2026-12345", descriptions: [{ lang: "en", value: "A Node.js runtime vulnerability in example code" }], published: "2026-11-08T06:00:00Z", metrics: { cvssMetricV31: [{ cvssData: { baseSeverity: "CRITICAL" } }] } };
  const matches = toNvdFindings(cve, watchEntries(catalog));
  assert.equal(matches.length, 1);
  assert.equal(matches[0].confidence, "KEYWORD_ONLY");
  assert.equal(matches[0].severity, "CRITICAL");
  assert.deepEqual(matches[0].products.map((x) => x.id).sort(), ["entry", "minerva-console", "minerva-webpage"]);
  assert.equal(toNvdFindings({ ...cve, descriptions: [{ lang: "en", value: "Other product" }] }, watchEntries(catalog)).length, 0);
});

test("duplicate advisories only render once per fingerprint", () => {
  const entry = watchEntries(catalog).find((x) => x.package === "next" && x.version === "16.4.1");
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
