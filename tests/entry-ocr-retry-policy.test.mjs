import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  shouldRetryOcrError,
  storageErrorStatus,
} from "../supabase/functions/extract-plate-text/retry-policy.mjs";

const edge = await readFile("supabase/functions/extract-plate-text/index.ts", "utf8");
const migration = await readFile(
  "supabase/migrations/20260907182000_entry_ocr_production_hardening.sql",
  "utf8",
);

test("transient network, timeout, provider rate-limit and server errors retain bounded retry", () => {
  for (const error of [
    "GEMINI_NETWORK_ERROR",
    "GEMINI_INVALID_RESPONSE",
    "GEMINI_HTTP_408",
    "GEMINI_HTTP_429",
    "GEMINI_HTTP_500",
    "GEMINI_HTTP_502",
    "GEMINI_HTTP_503",
    "GEMINI_HTTP_599",
    "OCR_IMAGE_DOWNLOAD_FAILED",
    "OCR_ENTRY_LOG_LOOKUP_FAILED",
    "OCR_PERSIST_FAILED",
  ]) {
    assert.equal(shouldRetryOcrError(error), true, error);
  }
});

test("deterministic invalid output and permanent contract/storage failures never retry", () => {
  for (const error of [
    "OCR_INVALID_OUTPUT",
    "GEMINI_HTTP_400",
    "GEMINI_HTTP_401",
    "GEMINI_HTTP_403",
    "GEMINI_HTTP_404",
    "GEMINI_HTTP_422",
    "OCR_REQUEST_IMAGE_PATH_REQUIRED",
    "OCR_REQUEST_UNSUPPORTED_BUCKET",
    "OCR_REQUEST_ENTRY_LOG_NOT_FOUND",
    "OCR_REQUEST_COMMUNITY_MISSING",
    "OCR_REQUEST_IMAGE_MISMATCH",
    "OCR_IMAGE_NOT_FOUND",
    "OCR_IMAGE_STORAGE_REJECTED",
  ]) {
    assert.equal(shouldRetryOcrError(error), false, error);
  }
});

test("missing object is permanent but an unclassified storage error remains bounded retry", () => {
  assert.equal(storageErrorStatus({ statusCode: "404" }), 404);
  assert.equal(storageErrorStatus({ status: 503 }), 503);
  assert.equal(storageErrorStatus({ statusCode: "503" }), 503);
  assert.equal(storageErrorStatus({ statusCode: "not-a-status" }), null);
  assert.equal(storageErrorStatus(null), null);
  assert.equal(shouldRetryOcrError("OCR_IMAGE_NOT_FOUND"), false);
  assert.equal(shouldRetryOcrError("OCR_IMAGE_DOWNLOAD_FAILED"), true);
});

test("invalid output is recorded as a failed provider call then handled terminally", () => {
  assert.match(edge, /if \(!isNoPlate && !plateText\)/);
  assert.match(edge, /errorCode: "OCR_INVALID_OUTPUT"[\s\S]*await markQueueFailure\("OCR_INVALID_OUTPUT"\)/);
  assert.match(edge, /const terminal = exhausted \|\| !shouldRetryOcrError\(errorCode\)/);
  assert.match(edge, /status: terminal \? "FAILED" : "PENDING"/);
  assert.match(edge, /\.in\("status", \["PENDING", "PROCESSING"\]\)/);
  assert.match(edge, /p_operation: "image_ocr"/);
});

test("valid plate and NO_PLATE both persist and complete, without reopening DONE", () => {
  assert.match(edge, /\["NO_PLATE", "NOPLATE", "NO PLATE"\]\.includes\(sentinel\)/);
  assert.match(edge, /\^\[A-Z\]\{2,4\}-\?\[0-9\]\{3,5\}\$/);
  assert.match(edge, /resultKind: plateText \? "plate" : "no_plate"/);
  assert.match(edge, /\.update\(\{ vehicle_plate_text: plateText \}\)/);
  assert.match(edge, /status: "DONE"/);
  assert.match(migration, /if OLD\.status = 'DONE' then[\s\S]*NEW\.status := 'DONE'/);
});

test("strict deployed OCR safeguards and nonblocking check-in remain intact", () => {
  assert.match(edge, /parts\.filter\(\(part\) => part\.text && !part\.thought\)/);
  assert.doesNotMatch(edge, /for \(const part of parts\)\s*\{\s*if \(part\.text/);
  assert.match(edge, /thinkingConfig: \{ thinkingBudget: 0 \}/);
  assert.match(migration, /for update of q skip locked/i);
  assert.match(migration, /exception\s+when others then[\s\S]*return NEW;/i);
  assert.doesNotMatch(edge, /console\.log\([^\n]*rawText/);
});
