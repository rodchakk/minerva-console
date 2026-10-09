import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

function read(path) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

test("payment proof upload accepts only private-bucket MIME types and enforces 10 MiB", () => {
  const source = read("features/seshat/financialEngine.ts");
  for (const mime of ["image/jpeg", "image/png", "image/webp", "application/pdf"]) {
    assert.ok(source.includes(`"${mime}"`));
  }
  assert.match(source, /MAX_PAYMENT_PROOF_BYTES = 10 \* 1024 \* 1024/);
  assert.match(source, /export function validatePaymentProof/);
  assert.match(source, /if \(file\.size === 0\)/);
  assert.match(source, /if \(file\.size > MAX_PAYMENT_PROOF_BYTES\)/);
});

test("existing-proof attachment cannot create a second payment or modify amount/date", () => {
  const source = read("features/seshat/financialEngine.ts");
  const start = source.indexOf("export async function attachPaymentProof(");
  const end = source.indexOf("export async function getPaymentProofSignedUrl(", start);
  assert.ok(start >= 0 && end > start);
  const attachment = source.slice(start, end);

  assert.match(attachment, /supabase\.auth\.getUser\(\)/);
  assert.match(attachment, /authData\.user\?\.id !== ownerId/);
  assert.match(attachment, /\.eq\("invoice_id", invoiceId\)/);
  assert.match(attachment, /\.eq\("owner_id", ownerId\)/);
  assert.match(attachment, /if \(payment\.proof_path\)/);
  assert.match(attachment, /\.from\("payment-proofs"\)/);
  assert.match(attachment, /upsert: false/);
  assert.match(attachment, /\.update\(\{ proof_path: proofPath \}\)/);
  assert.match(attachment, /\.is\("proof_path", null\)/);
  assert.match(attachment, /if \(!attached\) await bucket\.remove/);
  assert.doesNotMatch(attachment, /recordPayment\(|\.rpc\("record_payment"|\.update\(\{[^}]*amount/);
});

test("invoice detail uses a direct upload action with inline errors for existing payments", () => {
  const source = read("features/seshat/SeshatWorkspace.tsx");
  const uploaderStart = source.indexOf("function ExistingPaymentProofUploader(");
  const detailStart = source.indexOf("function InvoiceDetail(", uploaderStart);
  const billingStart = source.indexOf("function Billing(", detailStart);
  assert.ok(uploaderStart >= 0 && detailStart > uploaderStart && billingStart > detailStart);
  const uploader = source.slice(uploaderStart, detailStart);
  const detail = source.slice(detailStart, billingStart);

  assert.match(detail, /payment\.proof_path \? \(/);
  assert.match(detail, /Open proof/);
  assert.match(detail, /<ExistingPaymentProofUploader paymentId=\{payment\.id\}/);
  assert.match(uploader, /Attach proof \(JPG, PNG, WebP, PDF; max 10 MB\)/);
  assert.match(uploader, /onClick=\{upload\}/);
  assert.match(uploader, /onAttachProof\(selectedFile, paymentId\)/);
  assert.match(uploader, /role="alert"/);
  assert.match(uploader, /disabled=\{isUploading \|\| !selectedFile\}/);
  assert.match(source, /await attachPaymentProof\(/);
  assert.match(source, /await loadDetail\(\);\s*setNotice\("Payment proof attached successfully/);
});
