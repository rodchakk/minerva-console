import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { webcrypto } from "node:crypto";
import vm from "node:vm";
import { shouldRetryOcrError, storageErrorStatus } from "../../supabase/functions/extract-plate-text/retry-policy.mjs";

const source = await readFile("supabase/functions/extract-plate-text/index.ts", "utf8");
// Execute the actual handler. Replace only its two external/module imports;
// no OCR, persistence, retry, or authorization logic is copied into this test.
const executable = stripTypeScriptTypes(source.replace(/^import .*;\r?\n/gm, ""));

export const providerPayload = (text) => ({
  candidates: [{ content: { parts: [{ text }] } }],
  usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 2, totalTokenCount: 12 },
});

export function createOcrHarness(options = {}) {
  const state = {
    entry: { id: "entry-fixture", community_id: "community-fixture", vehicle_photo_path: "fixture.jpg", vehicle_plate_text: null },
    queue: { id: "queue-fixture", entry_log_id: "entry-fixture", status: options.status ?? "PENDING", attempts: options.attempts ?? 0, max_attempts: 5, completed_at: null, last_error: null },
    events: [], usage: [], logs: [], requests: [], providerCalls: 0, writes: 0,
  };
  if (options.missingQueue) state.queue = null;
  if (options.entry) Object.assign(state.entry, options.entry);

  class Query {
    constructor(table) { this.table = table; this.filters = []; }
    select() { return this; }
    eq(key, value) { this.filters.push((row) => row[key] === value); return this; }
    is(key, value) { return this.eq(key, value); }
    in(key, values) { this.filters.push((row) => values.includes(row[key])); return this; }
    update(value) { this.patch = value; return this; }
    maybeSingle() { return this.execute(); }
    then(resolve, reject) { return this.execute().then(resolve, reject); }
    async execute() {
      assert.ok(["entry_logs", "plate_ocr_queue"].includes(this.table));
      if (this.table === "entry_logs" && this.patch) {
        options.beforePersist?.(state);
        if (options.persist === "throw") throw new Error("synthetic transport failure");
        if (options.persist === "error") return { data: null, error: { code: "fixture_write_failure" } };
        if (options.persist === "zero") return { data: null, error: null };
      }
      if (this.table === "plate_ocr_queue" && !this.patch && options.queueLookupError) {
        return { data: null, error: { code: "fixture_lookup_failure" } };
      }
      if (this.table === "plate_ocr_queue" && !this.patch && state.writes > 0 && options.completionLookupError) {
        return { data: null, error: { code: "fixture_completion_lookup_failure" } };
      }
      if (this.table === "plate_ocr_queue" && this.patch?.status === "DONE" && options.queueDoneError) {
        return { data: null, error: { code: "fixture_queue_failure" } };
      }
      const row = this.table === "entry_logs" ? state.entry : state.queue;
      if (!row || !this.filters.every((filter) => filter(row))) return { data: null, error: null };
      if (this.patch) {
        Object.assign(row, this.patch);
        if (this.table === "entry_logs") {
          state.writes++;
          state.events.push("persisted");
          // Model the existing SQL trigger's atomic effect, including null -> null.
          // The production migration is unchanged; these are handler tests, not a DB integration test.
          if (["PENDING", "PROCESSING"].includes(state.queue?.status)) {
            Object.assign(state.queue, { status: "DONE", completed_at: new Date().toISOString(), last_error: null });
            state.events.push("trigger:DONE");
          }
          if (options.persist === "lost-ack") throw new Error("synthetic lost commit acknowledgement");
        } else {
          state.events.push(`queue:${this.patch.status}`);
        }
      }
      return { data: { ...row }, error: null };
    }
  }

  const client = {
    from: (table) => new Query(table),
    storage: { from: (bucket) => {
      assert.equal(bucket, "entry-photos");
      return { download: async () => ({ data: options.storageError ? null : new Blob(["synthetic image"]), error: options.storageError ?? null }) };
    } },
    rpc: async (name, args) => {
      if (name === "record_entry_usage_v1") state.usage.push(JSON.parse(JSON.stringify(args)));
      else state.events.push(name);
      return { error: null };
    },
  };
  let handler;
  const config = { SUPABASE_URL: "https://fixture.invalid", SUPABASE_SERVICE_ROLE_KEY: "fixture-service-key", GEMINI_API_KEY: "fixture-gemini-key", ...options.env };
  vm.runInNewContext(executable, {
    Deno: { env: { get: (key) => config[key] }, serve: (fn) => { handler = fn; } },
    createClient: () => client, shouldRetryOcrError, storageErrorStatus,
    Request, Response, Blob, atob, btoa, crypto: webcrypto,
    AbortSignal: { timeout: (ms) => { assert.equal(ms, 12_000); return AbortSignal.abort(); } },
    console: Object.fromEntries(["warn", "error", "log"].map((level) => [level, (...args) => state.logs.push([level, ...args])])),
    fetch: async (url, init) => {
      assert.match(url, /^https:\/\/generativelanguage.googleapis.com\/.*gemini-2.5-flash:generateContent$/);
      assert.equal(init.headers["x-goog-api-key"], "fixture-gemini-key");
      state.providerCalls++;
      state.requests.push(JSON.parse(init.body));
      options.duringProvider?.(state);
      if (options.networkError) throw options.networkError === "timeout"
        ? new DOMException("synthetic timeout", "TimeoutError")
        : new Error("synthetic network failure");
      const body = options.invalidJson ? "{" : JSON.stringify(options.payload ?? providerPayload(options.text ?? "NO_PLATE"));
      return new Response(body, { status: options.httpStatus ?? 200 });
    },
  }, { filename: "extract-plate-text/index.ts" });
  assert.equal(typeof handler, "function");
  state.invoke = async ({ role = "service_role", token, body, method = "POST" } = {}) => {
    // Signature verification belongs to Supabase's gateway, not this role-check fixture.
    const jwt = token ?? `fixture.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.fixture`;
    const req = new Request("https://fixture.invalid/extract-plate-text", {
      method,
      headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
      ...(method === "POST" ? { body: JSON.stringify(body ?? { entry_log_id: "entry-fixture", image_path: "fixture.jpg" }) } : {}),
    });
    const response = await handler(req);
    return { status: response.status, body: await response.json() };
  };
  return state;
}
