import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

test("community push worker caps claim size and provider request time", () => {
  const source = read("supabase/functions/smart-service/index.ts");

  assert.match(source, /const EXPO_REQUEST_TIMEOUT_MS = 8_000/);
  assert.match(source, /const MAX_QUEUE_LIMIT = 5/);
  assert.match(source, /Math\.min\(Math\.trunc\(requestedLimit\), MAX_QUEUE_LIMIT\)/);
  assert.match(source, /signal: AbortSignal\.timeout\(EXPO_REQUEST_TIMEOUT_MS\)/);
  assert.match(source, /\{ p_limit: limit \}/);
});

test("mobile receipt worker caps a recovery batch and provider request time", () => {
  const source = read("supabase/functions/entry-push-receipts/index.ts");

  assert.match(source, /const EXPO_RECEIPTS_TIMEOUT_MS = 8_000/);
  assert.match(source, /const MAX_RECEIPTS_PER_RUN = 50/);
  assert.match(source, /const RECEIPT_CHUNK_SIZE = 50/);
  assert.match(source, /Math\.min\(Math\.trunc\(requested\), MAX_RECEIPTS_PER_RUN\)/);
  assert.match(source, /signal: AbortSignal\.timeout\(EXPO_RECEIPTS_TIMEOUT_MS\)/);
});

test("OCR provider request has a finite deadline", () => {
  const source = read("supabase/functions/extract-plate-text/index.ts");

  assert.match(source, /const GEMINI_REQUEST_TIMEOUT_MS = 12_000/);
  assert.match(source, /signal: AbortSignal\.timeout\(GEMINI_REQUEST_TIMEOUT_MS\)/);
});
