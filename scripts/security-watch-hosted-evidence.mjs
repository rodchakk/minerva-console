// Pure, read-only UI classification; no scanner, storage or alert mutation.
import evidence from "../security-watch/hosted-storage-verifications.json" with { type: "json" };

function compareVersions(actual, required) {
  const parse = (value) => /^\d+\.\d+\.\d+$/.test(value)
    ? value.split(".").map(Number) : null;
  const a = parse(actual);
  const b = parse(required);
  if (!a || !b) return null;
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return 1;
    if (a[i] < b[i]) return -1;
  }
  return 0;
}

export function hostedStorageAdvisoryStatus(finding, checkedAt, proof = evidence) {
  if (!finding || finding.source !== "github" ||
      finding.confidence !== "VENDOR_NOTICE" ||
      finding.technology !== "Supabase" || finding.version !== "managed" ||
      !Array.isArray(finding.products) || finding.products.length === 0 ||
      proof?.service !== "supabase/storage") return null;

  const advisory = proof.advisories?.find((candidate) => candidate.id === finding.advisoryId);
  if (!advisory || finding.url !==
      "https://github.com/supabase/storage/security/advisories/" + advisory.id ||
      !finding.products.every((product) => {
        const verified = proof.products?.[product.id];
        return verified && product.name === verified.projectName &&
          compareVersions(verified.verifiedVersion, advisory.firstFixedVersion) >= 0;
      })) return null;

  const verifiedAt = Date.parse(proof.verificationDate + "T00:00:00.000Z");
  const scannedAt = Date.parse(checkedAt || "");
  if (!Number.isFinite(verifiedAt)) return null;
  const maxAge = proof.maxEvidenceAgeDays * 86400_000;
  const validRecency = Number.isFinite(scannedAt) &&
    scannedAt - verifiedAt <= maxAge;
  return {
    status: validRecency ? "verified" : "recheck",
    verifiedAt: proof.verificationDate,
    installedVersion: finding.products.map((p) => proof.products[p.id].verifiedVersion).join(" / "),
    firstFixedVersion: advisory.firstFixedVersion,
    method: proof.method,
    originalSeverity: finding.severity
  };
}
