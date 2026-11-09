// Pure catalog and advisory matching helpers. No access to product systems.
const PRIORITY = new Set(["CRITICAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN"]);

export function validCatalog(catalog) {
  if (!catalog || catalog.schemaVersion !== 1 || !Array.isArray(catalog.products)) {
    throw new Error("Invalid Security Watch catalog format");
  }
  const products = new Set();
  for (const product of catalog.products) {
    if (!/^[a-z0-9-]{2,60}$/.test(product.id) || products.has(product.id)) {
      throw new Error("Invalid or duplicate product identifier");
    }
    products.add(product.id);
    if (!product.name || !product.team || !Array.isArray(product.technologies)) {
      throw new Error("Product missing name, team or technologies");
    }
    for (const tech of product.technologies) {
      if (!/^[a-z0-9-]{2,60}$/.test(tech.id) || !tech.name || !tech.version) {
        throw new Error("Invalid technology identifier, name or version");
      }
      if (tech.kind === "osv") {
        if (!tech.ecosystem || !tech.package || !/^\d+\.\d+\.\d+/.test(tech.version)) {
          throw new Error("OSV technology requires package, ecosystem and exact version");
        }
      } else if (tech.kind === "keyword") {
        if (!tech.keyword || tech.keyword.length > 50) throw new Error("Keyword technology missing search term");
      } else {
        throw new Error("Unsupported technology source");
      }
    }
  }
  return catalog;
}

export function watchEntries(catalog) {
  validCatalog(catalog);
  const entries = new Map();
  for (const product of catalog.products) {
    if (!product.enabled) continue;
    for (const tech of product.technologies) {
      const fingerprint = [tech.kind, tech.kind === "osv" ? tech.ecosystem : "", tech.kind === "osv" ? tech.package : tech.keyword, tech.version].join("|").toLowerCase();
      let entry = entries.get(fingerprint);
      if (!entry) {
        entry = { ...tech, watchKey: fingerprint, products: [] };
        entries.set(fingerprint, entry);
      }
      entry.products.push({ id: product.id, name: product.name, team: product.team });
    }
  }
  return [...entries.values()];
}

export function priority(value) {
  const severity = String(value || "").toUpperCase();
  return PRIORITY.has(severity) ? severity : "UNKNOWN";
}

export function osvPriority(vulnerability) {
  const direct = priority(vulnerability?.database_specific?.severity);
  if (direct !== "UNKNOWN") return direct;
  const scores = vulnerability?.severity || [];
  for (const item of scores) {
    if (typeof item.score !== "string") continue;
    const score = Number(item.score);
    if (Number.isFinite(score)) {
      if (score >= 9) return "CRITICAL";
      if (score >= 7) return "HIGH";
      if (score >= 4) return "MEDIUM";
      return "LOW";
    }
  }
  return "UNKNOWN";
}

export function toOsvFinding(vuln, entry) {
  if (!vuln?.id || vuln.withdrawn) return null;
  return {
    key: ["osv", vuln.id, entry.watchKey].join("|"),
    source: "osv",
    advisoryId: String(vuln.id).slice(0, 100),
    title: String(vuln.summary || vuln.id).slice(0, 240),
    summary: String(vuln.details || vuln.summary || "See the advisory for full details.").slice(0, 700),
    severity: osvPriority(vuln),
    publishedAt: vuln.published || null,
    modifiedAt: vuln.modified || null,
    url: "https://osv.dev/vulnerability/" + encodeURIComponent(vuln.id),
    technology: entry.name,
    version: entry.version,
    products: entry.products,
    confidence: "VERSION_MATCH",
    nextStep: "Verify the exact deployed version and exploitation prerequisites with the responsible AI."
  };
}

export function nvdPriority(cve) {
  const metrics = cve?.metrics || {};
  const groups = ["cvssMetricV40", "cvssMetricV31", "cvssMetricV30", "cvssMetricV2"];
  for (const group of groups) {
    const first = metrics[group]?.[0];
    if (first?.cvssData?.baseSeverity) return priority(first.cvssData.baseSeverity);
    if (first?.baseSeverity) return priority(first.baseSeverity);
  }
  return "UNKNOWN";
}

export function toNvdFindings(cve, entries) {
  if (!cve?.id || cve.vulnStatus === "Rejected") return [];
  const summary = cve.descriptions?.find((d) => d.lang === "en")?.value || "";
  const normalized = summary.toLowerCase();
  const findings = [];
  for (const entry of entries) {
    if (entry.kind !== "keyword") continue;
    const keyword = entry.keyword.toLowerCase();
    if (!normalized.includes(keyword)) continue;
    findings.push({
      key: ["nvd", cve.id, entry.watchKey].join("|"),
      source: "nvd",
      advisoryId: String(cve.id).slice(0, 100),
      title: String(cve.id + " · " + summary).slice(0, 240),
      summary: String(summary).slice(0, 700),
      severity: nvdPriority(cve),
      publishedAt: cve.published || null,
      modifiedAt: cve.lastModified || null,
      url: "https://nvd.nist.gov/vuln/detail/" + encodeURIComponent(cve.id),
      technology: entry.name,
      version: entry.version,
      products: entry.products,
      confidence: "KEYWORD_ONLY",
      nextStep: "This is a keyword match only. Verify the affected product and versions; it may not apply."
    });
  }
  return findings;
}

export function withinWindow(vulnerability, sinceMs) {
  const published = Date.parse(vulnerability.publishedAt || "");
  const modified = Date.parse(vulnerability.modifiedAt || "");
  return (Number.isFinite(published) && published >= sinceMs) ||
    (Number.isFinite(modified) && modified >= sinceMs);
}

export function deduplicate(findings) {
  const map = new Map();
  for (const finding of findings) {
    if (typeof finding?.key === "string" && finding.key.length <= 255) map.set(finding.key, finding);
  }
  return [...map.values()].sort((a, b) => {
    const rank = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, UNKNOWN: 4 };
    const diff = (rank[a.severity] ?? 4) - (rank[b.severity] ?? 4);
    return diff || String(b.publishedAt || "").localeCompare(String(a.publishedAt || ""));
  }).slice(0, 160);
}

export function toProviderAdvisoryFindings(advisory, repository, entries) {
  if (!/^[a-z0-9-]+\/[a-z0-9-]+$/.test(repository) ||
      !advisory?.ghsa_id || advisory.withdrawn_at || !advisory.published_at) return [];
  const id = String(advisory.ghsa_id);
  if (!/^GHSA-[a-z0-9-]{10,40}$/i.test(id)) return [];
  const matches = entries.filter((entry) =>
    entry.kind === "keyword" && entry.keyword.toLowerCase() === "supabase");
  return matches.map((entry) => ({
    key: ["github", id, entry.watchKey].join("|"),
    source: "github",
    advisoryId: id,
    title: String(advisory.summary || id).slice(0, 240),
    summary: String(advisory.description || advisory.summary || "See vendor advisory.").slice(0, 700),
    severity: priority(advisory.severity),
    publishedAt: advisory.published_at,
    modifiedAt: advisory.updated_at || null,
    url: "https://github.com/" + repository + "/security/advisories/" + encodeURIComponent(id),
    technology: entry.name,
    version: entry.version,
    products: entry.products,
    confidence: "VENDOR_NOTICE",
    nextStep: "Vendor bulletin only. Confirm whether Supabase already patched hosted projects and whether any client action remains."
  }));
}
