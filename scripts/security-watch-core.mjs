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


// Interpret CVSS 3.0/3.1 vector strings only; never guess severity for CVSS 4.
export function cvss3BaseScore(vector) {
  if (typeof vector !== "string" || !/^CVSS:3\.[01]\//.test(vector)) return null;
  const parts = Object.fromEntries(vector.split("/").slice(1).map((v) => v.split(":")));
  const AV = { N: 0.85, A: 0.62, L: 0.55, P: 0.2 }[parts.AV];
  const AC = { L: 0.77, H: 0.44 }[parts.AC];
  const S = parts.S;
  const PR = (S === "C" ? { N: 0.85, L: 0.68, H: 0.5 } : { N: 0.85, L: 0.62, H: 0.27 })[parts.PR];
  const UI = { N: 0.85, R: 0.62 }[parts.UI];
  const C = { N: 0, L: 0.22, H: 0.56 }[parts.C];
  const I = { N: 0, L: 0.22, H: 0.56 }[parts.I];
  const A = { N: 0, L: 0.22, H: 0.56 }[parts.A];
  if (![AV, AC, PR, UI, C, I, A].every(Number.isFinite) || !["U", "C"].includes(S)) return null;
  const impactSub = 1 - (1 - C) * (1 - I) * (1 - A);
  const impact = S === "U" ? 6.42 * impactSub :
    7.52 * (impactSub - 0.029) - 3.25 * (impactSub - 0.02) ** 15;
  if (impact <= 0) return 0;
  const exploit = 8.22 * AV * AC * PR * UI;
  const raw = Math.min((S === "U" ? 1 : 1.08) * (impact + exploit), 10);
  return Math.ceil((raw - 1e-8) * 10) / 10;
}
export function cvssSeverity(score) {
  if (!Number.isFinite(score) || score < 0 || score > 10) return "UNKNOWN";
  if (score >= 9) return "CRITICAL";
  if (score >= 7) return "HIGH";
  if (score >= 4) return "MEDIUM";
  if (score > 0) return "LOW";
  return "UNKNOWN";
}

export function osvPriority(vulnerability) {
  const direct = priority(vulnerability?.database_specific?.severity);
  if (direct !== "UNKNOWN") return direct;
  const scores = vulnerability?.severity || [];
  for (const item of scores) {
    if (typeof item.score !== "string") continue;
    const score = Number(item.score);
    if (Number.isFinite(score)) return cvssSeverity(score);
    const cvss3 = cvss3BaseScore(item.score);
    if (cvss3 !== null) return cvssSeverity(cvss3);
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

function matchesCanonicalCpe(cve, target) {
  if (!target || !/^[a-z0-9._-]+$/.test(target.vendor) ||
      !/^[a-z0-9._-]+$/.test(target.product)) return false;
  const configs = Array.isArray(cve?.configurations) ? cve.configurations : [];
  function walk(node) {
    if (!node || typeof node !== "object") return false;
    for (const match of node.cpeMatch || []) {
      if (match.vulnerable === false || typeof match.criteria !== "string") continue;
      const parts = match.criteria.split(":");
      if (parts.length >= 6 && parts[0] === "cpe" && parts[1] === "2.3" &&
          parts[3] === target.vendor && parts[4] === target.product) return true;
    }
    return Array.isArray(node.children) && node.children.some(walk);
  }
  return configs.some((config) => (config.nodes || []).some(walk));
}

export function toNvdFindings(cve, entries) {
  if (!cve?.id || cve.vulnStatus === "Rejected") return [];
  const summary = cve.descriptions?.find((d) => d.lang === "en")?.value || "";
  const findings = [];
  for (const entry of entries) {
    if (entry.kind !== "keyword" || !matchesCanonicalCpe(cve, entry.nvdCpe)) continue;
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
      confidence: "CPE_PRODUCT",
      nextStep: "The advisory's structured product ID matches this technology. Verify the actual deployed VERSION and affected range before acting."
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

const PROVIDER_SECURITY_FEEDS = {
  "supabase/storage": "Supabase",
  "supabase/auth": "Supabase",
  "supabase/realtime": "Supabase",
  "vercel/next.js": "Next.js",
  "nodejs/node": "Node.js"
};
function cmpVersion(a, b) {
  const left = a.match(/^(\d+)\.(\d+)\.(\d+)/);
  const right = b.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!left || !right) return null;
  for (let i = 1; i <= 3; i++) {
    const diff = Number(left[i]) - Number(right[i]);
    if (diff) return Math.sign(diff);
  }
  return 0;
}
export function matchesSimpleVersionRange(version, range) {
  if (range === "*" || range === ">= 0") return true;
  if (typeof range !== "string") return null;
  // Only exclude a version when every comparator is understood and definite.
  const alternatives = range.split("||").map((s) => s.trim()).filter(Boolean);
  if (!alternatives.length) return null;
  let uncertain = false;
  for (const alternative of alternatives) {
    let satisfied = true;
    for (const part of alternative.split(",").map((s) => s.trim()).filter(Boolean)) {
      const match = part.match(/^(<=|>=|<|>|=)?\s*(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/);
      if (!match) { uncertain = true; satisfied = false; break; }
      const compared = cmpVersion(version, match[2]);
      if (compared === null) { uncertain = true; satisfied = false; break; }
      const op = match[1] || "=";
      const passed = op === "<=" ? compared <= 0 :
        op === "<" ? compared < 0 : op === ">=" ? compared >= 0 :
        op === ">" ? compared > 0 : compared === 0;
      if (!passed) { satisfied = false; break; }
    }
    if (satisfied) return true;
  }
  return uncertain ? null : false;
}

export function toProviderAdvisoryFindings(advisory, repository, entries) {
  const name = PROVIDER_SECURITY_FEEDS[repository];
  if (!name || !advisory?.ghsa_id || advisory.withdrawn_at ||
      !advisory.published_at) return [];
  const id = String(advisory.ghsa_id);
  if (!/^GHSA-[a-z0-9-]{10,40}$/i.test(id)) return [];
  const matches = entries.filter((entry) => entry.name === name);
  const versions = Array.isArray(advisory.vulnerabilities) ? advisory.vulnerabilities : [];
  return matches.filter((entry) => {
    if (repository !== "vercel/next.js") return true;
    const packageRanges = versions.filter((v) => v?.package?.name === "next" &&
      v?.package?.ecosystem?.toLowerCase() === "npm" && v.vulnerable_version_range);
    if (!packageRanges.length) return true; // Vendor notice lacks ranges; review it manually.
    const evaluations = packageRanges.map((v) => matchesSimpleVersionRange(entry.version, v.vulnerable_version_range));
    return evaluations.some((v) => v === true || v === null);
  }).map((entry) => {
    const rangeSummary = repository === "vercel/next.js"
      ? versions.filter((v) => v?.package?.name === "next")
        .map((v) => [v.vulnerable_version_range, v.patched_versions &&
          "patched: " + v.patched_versions].filter(Boolean).join(" → ")).slice(0, 5).join("; ")
      : "";
    return {
      key: ["github", id, entry.watchKey].join("|"),
      source: "github",
      advisoryId: id,
      title: String(advisory.summary || id).slice(0, 240),
      summary: String((advisory.description || advisory.summary || "See official advisory.") +
        (rangeSummary ? "\nAffected published ranges: " + rangeSummary : "")).slice(0, 700),
      severity: priority(advisory.severity),
      publishedAt: advisory.published_at,
      modifiedAt: advisory.updated_at || null,
      url: "https://github.com/" + repository + "/security/advisories/" + encodeURIComponent(id),
      technology: entry.name,
      version: entry.version,
      products: entry.products,
      confidence: "VENDOR_NOTICE",
      nextStep: "Official vendor bulletin. Confirm affected version ranges, runtime requirements and whether the provider already patched hosted environments."
    };
  });
}
