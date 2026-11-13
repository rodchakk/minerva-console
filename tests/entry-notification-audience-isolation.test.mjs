import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = process.cwd();
const workerPath = join(root, "supabase/functions/smart-service/index.ts");
const migrationPath = join(
  root,
  "supabase/migrations/20261028032025_bedrock_f02_notification_audience_isolation.sql",
);
const migration = readFileSync(migrationPath, "utf8");

const ids = {
  queue: "10000000-0000-4000-8000-000000000001",
  message: "20000000-0000-4000-8000-000000000002",
  community: "30000000-0000-4000-8000-000000000003",
  user: "40000000-0000-4000-8000-000000000004",
  claim: "50000000-0000-4000-8000-000000000005",
};

function row(overrides = {}) {
  return {
    queue_id: ids.queue,
    message_id: ids.message,
    community_id: ids.community,
    push_title: "Synthetic title",
    push_body: "Synthetic body",
    attempts: 1,
    audience_type: "PRIVATE",
    target_user_id: ids.user,
    claim_token: ids.claim,
    delivery_stage: "PRE_PROVIDER",
    ...overrides,
  };
}

class Query {
  constructor(table, resolve, calls) {
    this.table = table;
    this.resolve = resolve;
    this.calls = calls;
    this.operation = "select";
    this.filters = [];
    this.payload = null;
  }
  select(columns) { this.operation = "select"; this.columns = columns; return this; }
  insert(payload) { this.operation = "insert"; this.payload = payload; return this; }
  upsert(payload, options) { this.operation = "upsert"; this.payload = payload; this.options = options; return this; }
  eq(column, value) { this.filters.push(["eq", column, value]); return this; }
  in(column, value) { this.filters.push(["in", column, value]); return this; }
  not(column, operator, value) { this.filters.push(["not", column, operator, value]); return this; }
  limit(value) { this.filters.push(["limit", value]); return this; }
  then(resolve, reject) {
    const call = {
      kind: "table",
      table: this.table,
      operation: this.operation,
      filters: this.filters,
      payload: this.payload,
      options: this.options,
    };
    this.calls.push(call);
    return Promise.resolve(this.resolve(call)).then(resolve, reject);
  }
}

async function loadWorker({ claimed = [row()], onRpc, onTable, onFetch } = {}) {
  const calls = [];
  const client = {
    async rpc(name, args) {
      calls.push({ kind: "rpc", name, args });
      if (onRpc) {
        const resolved = await onRpc(name, args, calls);
        if (resolved) return resolved;
      }
      if (name === "claim_pending_community_message_pushes_v2") return { data: claimed, error: null };
      if (name === "retry_community_message_push_pre_provider_v2") {
        return { data: { ok: true, outcome: "retry_scheduled" }, error: null };
      }
      return { data: { ok: true }, error: null };
    },
    from(table) {
      return new Query(table, (call) => {
        if (onTable) {
          const resolved = onTable(call, calls);
          if (resolved) return resolved;
        }
        if (table === "community_members") return { data: [{ user_id: ids.user }], error: null };
        if (table === "user_push_tokens") {
          return { data: [{ expo_push_token: "ExpoPushToken[synthetic]" }], error: null };
        }
        if (table === "entry_mobile_push_receipts" && call.operation === "select") {
          return { data: [], error: null };
        }
        return { data: null, error: null };
      }, calls);
    },
  };

  let source = readFileSync(workerPath, "utf8")
    .replace(
      "import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'",
      "const createClient = globalThis.__createClient",
    )
    .replace(/Deno\.serve\((async[\s\S]*)\)\s*$/, "globalThis.__handler = $1");
  source = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText;

  const context = {
    __createClient: () => client,
    Deno: { env: { get: (name) => ({
      INTERNAL_QUEUE_SECRET: "synthetic-secret",
      SUPABASE_URL: "https://synthetic.invalid",
      SUPABASE_SERVICE_ROLE_KEY: "synthetic-role-key",
    })[name] } },
    fetch: async (...args) => {
      calls.push({ kind: "fetch", args });
      if (onFetch) return onFetch(...args);
      return new Response(JSON.stringify({ data: [{ status: "ok", id: "synthetic-ticket" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
    Request,
    Response,
    Headers,
    AbortSignal,
    TextEncoder,
    crypto: globalThis.crypto,
    console,
    setTimeout,
    clearTimeout,
  };
  context.globalThis = context;
  vm.runInContext(source, vm.createContext(context));
  assert.equal(typeof context.__handler, "function");

  const response = await context.__handler(new Request("https://synthetic.invalid/worker", {
    method: "POST",
    headers: { Authorization: "Bearer synthetic-secret", "Content-Type": "application/json" },
    body: JSON.stringify({ limit: 5 }),
  }));
  return { response, body: await response.json(), calls };
}

test("v2 claim contract atomically snapshots audience and enforces tenant identity", () => {
  assert.match(migration, /claim_pending_community_message_pushes_v2/);
  assert.match(migration, /case when m\.target_user_id is null then 'PUBLIC'/);
  assert.match(migration, /foreign key \(message_id, community_id\)/);
  assert.match(migration, /for update of q skip locked/i);
  assert.match(migration, /claim_token uuid/);
  assert.match(migration, /INVALID_PRIVATE_AUDIENCE/);
});

test("legacy compatibility bridge can claim public messages only", () => {
  const legacy = migration.slice(
    migration.indexOf("create or replace function public.claim_pending_community_message_pushes("),
    migration.indexOf("create or replace function public.claim_pending_community_message_pushes_v2("),
  );
  assert.match(legacy, /m\.target_user_id is null/);
  assert.doesNotMatch(legacy, /m\.target_user_id is not null/);
});

test("state machine only requeues leased PRE_PROVIDER work and quarantines ambiguity", () => {
  assert.match(migration, /'PRE_PROVIDER'[\s\S]*'PROVIDER_CONTACTED'[\s\S]*'UNKNOWN_OUTCOME'[\s\S]*'CONFIRMED'[\s\S]*'FAILED'/);
  assert.match(migration, /delivery_stage = 'PRE_PROVIDER'[\s\S]*claim_token is not null[\s\S]*status = 'pending'/);
  assert.match(migration, /PROVIDER_CONTACTED claims are never automatically replayed/);
  assert.match(migration, /STALE_PROVIDER_OUTCOME_UNKNOWN/);
});

test("private audience is community-scoped and provider contact precedes synthetic delivery", async () => {
  const result = await loadWorker();
  assert.equal(result.response.status, 200);
  assert.equal(result.body.summary[0].status, "confirmed");

  const privateMembership = result.calls.find((call) => call.kind === "table" && call.table === "community_members");
  assert.ok(privateMembership.filters.some((filter) => filter[1] === "community_id" && filter[2] === ids.community));
  assert.ok(privateMembership.filters.some((filter) => filter[1] === "user_id" && filter[2] === ids.user));
  const tokenQuery = result.calls.find((call) => call.kind === "table" && call.table === "user_push_tokens");
  assert.ok(tokenQuery.filters.some((filter) => filter[1] === "community_id" && filter[2] === ids.community));

  const contactIndex = result.calls.findIndex((call) => call.name === "mark_community_message_push_provider_contacted_v2");
  const fetchIndex = result.calls.findIndex((call) => call.kind === "fetch");
  const completeIndex = result.calls.findIndex((call) => call.name === "complete_community_message_push_v2");
  assert.ok(contactIndex >= 0 && contactIndex < fetchIndex && fetchIndex < completeIndex);
});

test("explicit public audience remains bounded to active community roles and tokens", async () => {
  const result = await loadWorker({
    claimed: [row({ audience_type: "PUBLIC", target_user_id: null })],
  });
  assert.equal(result.body.summary[0].status, "confirmed");
  const membership = result.calls.find((call) => call.kind === "table" && call.table === "community_members");
  assert.ok(membership.filters.some((filter) => filter[0] === "in"
    && filter[1] === "role" && filter[2].join(",") === "ADMIN,RESIDENT"));
  assert.equal(membership.filters.some((filter) => filter[1] === "user_id"), false);
  const tokenQuery = result.calls.find((call) => call.kind === "table" && call.table === "user_push_tokens");
  assert.ok(tokenQuery.filters.some((filter) => filter[1] === "community_id" && filter[2] === ids.community));
});

test("mixed valid and invalid claims fail closed before provider contact", async () => {
  const result = await loadWorker({
    claimed: [row(), row({ queue_id: "60000000-0000-4000-8000-000000000006", target_user_id: null })],
  });
  assert.equal(result.response.status, 500);
  assert.equal(result.calls.some((call) => call.kind === "fetch"), false);
  assert.equal(result.calls.some((call) => call.name === "mark_community_message_push_provider_contacted_v2"), false);
  assert.equal(result.calls.some((call) => call.name === "retry_community_message_push_pre_provider_v2"), true);
});

test("pre-provider lookup errors schedule bounded retry without contacting Expo", async () => {
  const result = await loadWorker({
    onTable: (call) => call.table === "community_members"
      ? { data: null, error: { message: "synthetic lookup failure" } }
      : null,
  });
  assert.equal(result.body.summary[0].status, "pre_provider_retry");
  assert.equal(result.calls.some((call) => call.kind === "fetch"), false);
  assert.equal(result.calls.some((call) => call.name === "retry_community_message_push_pre_provider_v2"), true);
});

test("network ambiguity after provider contact becomes UNKNOWN_OUTCOME and is never retried", async () => {
  const result = await loadWorker({ onFetch: async () => { throw new Error("synthetic timeout"); } });
  assert.equal(result.body.summary[0].status, "unknown_outcome");
  const failure = result.calls.find((call) => call.name === "fail_community_message_push_v2");
  assert.equal(failure.args.p_unknown_outcome, true);
  assert.equal(result.calls.some((call) => call.name === "retry_community_message_push_pre_provider_v2"), false);
});

test("existing receipt blocks duplicate provider contact", async () => {
  const result = await loadWorker({
    onTable: (call) => call.table === "entry_mobile_push_receipts" && call.operation === "select"
      ? { data: [{ token_hash: "already-attempted" }], error: null }
      : null,
  });
  assert.equal(result.body.summary[0].status, "failed_duplicate_blocked");
  assert.equal(result.calls.some((call) => call.kind === "fetch"), false);
  assert.equal(result.calls.some((call) => call.name === "mark_community_message_push_provider_contacted_v2"), false);
});

test("partial provider acceptance is receipt-tracked and never automatically replayed", async () => {
  const result = await loadWorker({
    onTable: (call) => call.table === "user_push_tokens"
      ? { data: [
        { expo_push_token: "ExpoPushToken[synthetic-a]" },
        { expo_push_token: "ExpoPushToken[synthetic-b]" },
      ], error: null }
      : null,
    onFetch: async () => new Response(JSON.stringify({ data: [
      { status: "ok", id: "ticket-a" },
      { status: "error", details: { error: "DeviceNotRegistered" } },
    ] }), { status: 200, headers: { "Content-Type": "application/json" } }),
  });
  assert.equal(result.body.summary[0].status, "failed_partial");
  const receiptWrite = result.calls.find((call) => call.kind === "table"
    && call.table === "entry_mobile_push_receipts" && call.operation === "upsert");
  assert.equal(receiptWrite.payload.length, 1);
  assert.equal(receiptWrite.options.onConflict, "queue_id,token_hash");
  const failure = result.calls.find((call) => call.name === "fail_community_message_push_v2");
  assert.equal(failure.args.p_unknown_outcome, false);
  assert.equal(result.calls.some((call) => call.name === "retry_community_message_push_pre_provider_v2"), false);
});

test("concurrent synthetic invocations consume one atomic claim without duplicate send", async () => {
  const claimPool = [row()];
  const claimOnce = (name) => name === "claim_pending_community_message_pushes_v2"
    ? { data: claimPool.splice(0, 1), error: null }
    : null;
  const [first, second] = await Promise.all([
    loadWorker({ onRpc: claimOnce }),
    loadWorker({ onRpc: claimOnce }),
  ]);
  const fetches = [...first.calls, ...second.calls].filter((call) => call.kind === "fetch");
  assert.equal(fetches.length, 1);
  assert.deepEqual([first.body.claimed, second.body.claimed].sort(), [0, 1]);
  assert.match(migration, /unique index if not exists entry_mobile_push_receipts_queue_token_uidx/);
  assert.match(migration, /for update of q skip locked/i);
});
