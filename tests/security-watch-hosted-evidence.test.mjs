import assert from "node:assert/strict";
import { test } from "node:test";
import { hostedStorageAdvisoryStatus } from "../scripts/security-watch-hosted-evidence.mjs";
import proof from "../security-watch/hosted-storage-verifications.json" with { type: "json" };

const checkedAt = "2026-11-09T18:00:00.000Z";
function notice(id, products = ["entry", "seshat"]) {
  const name = { entry: "ENTRY", seshat: "Seshat", "third-party": "Other" };
  return {
    source: "github", confidence: "VENDOR_NOTICE", technology: "Supabase",
    version: "managed", advisoryId: id,
    url: "https://github.com/supabase/storage/security/advisories/" + id,
    severity: "CRITICAL",
    products: products.map((id) => ({ id, name: name[id] }))
  };
}

test("exactly three previously announced Storage GHSAs have version evidence", () => {
  assert.equal(proof.advisories.length, 3);
  for (const item of proof.advisories) {
    const result = hostedStorageAdvisoryStatus(notice(item.id), checkedAt);
    assert.equal(result?.status, "verified", item.id);
    assert.equal(result.firstFixedVersion, item.firstFixedVersion);
    assert.equal(result.installedVersion, "1.89.13 / 1.89.13");
  }
});

test("new, spoofed or unsupported issues remain unverified", () => {
  assert.equal(hostedStorageAdvisoryStatus(notice("GHSA-new0-0abc-0123"), checkedAt), null);
  assert.equal(hostedStorageAdvisoryStatus({ ...notice(proof.advisories[0].id), source: "osv" }, checkedAt), null);
  assert.equal(hostedStorageAdvisoryStatus({ ...notice(proof.advisories[0].id), url: "https://example.com/fake" }, checkedAt), null);
  assert.equal(hostedStorageAdvisoryStatus(notice(proof.advisories[0].id, ["entry", "third-party"]), checkedAt), null);
  assert.equal(hostedStorageAdvisoryStatus({ ...notice(proof.advisories[0].id), version: "1.89.13" }, checkedAt), null);
});

test("cannot claim fixed if an evidenced project version precedes its patch", () => {
  const altered = structuredClone(proof);
  altered.products.entry.verifiedVersion = "1.89.8";
  assert.equal(hostedStorageAdvisoryStatus(notice(proof.advisories[0].id), checkedAt, altered), null);
  assert.equal(hostedStorageAdvisoryStatus(notice(proof.advisories[0].id, ["seshat"]), checkedAt, altered)?.status, "verified");
});

test("verification evidence expires, rather than silently asserting indefinite safety", () => {
  const id = proof.advisories[1].id;
  const stale = hostedStorageAdvisoryStatus(notice(id), "2026-12-01T12:00:00.000Z");
  assert.equal(stale.status, "recheck");
  assert.equal(stale.originalSeverity, "CRITICAL");
  assert.equal(hostedStorageAdvisoryStatus(notice(id), undefined).status, "recheck");
});

test("missing verification metadata cannot fabricate remediation", () => {
  const bad = structuredClone(proof);
  bad.verificationDate = "invalid";
  assert.equal(hostedStorageAdvisoryStatus(notice(proof.advisories[0].id), checkedAt, bad), null);
});
