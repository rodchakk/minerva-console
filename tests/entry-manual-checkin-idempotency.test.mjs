import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();
const sql = readFileSync(join(root, "supabase/migrations/20261002011027_entry_manual_checkin_idempotency.sql"), "utf8");

test("manual check-in has a database uniqueness barrier", () => {
  assert.match(
    sql,
    /create unique index if not exists uq_manual_entries_community_client_reference/i,
  );
  assert.match(sql, /\(community_id, client_reference\)/i);
  assert.match(sql, /where client_reference is not null/i);
});

test("manual check-in serializes the same client operation and replays success", () => {
  assert.match(sql, /pg_advisory_xact_lock/i);
  assert.match(sql, /me\.client_reference = v_client_reference/i);
  assert.match(sql, /'duplicate', true/i);
  assert.match(sql, /el\.manual_entry_id = v_existing_manual_entry\.id/i);
});

test("idempotent replay remains fail-closed behind live membership validation", () => {
  const membership = sql.indexOf("Not authorized to register manual entries");
  const lock = sql.indexOf("pg_advisory_xact_lock");

  assert.ok(membership >= 0, "guard membership validation must exist");
  assert.ok(lock > membership, "replay must happen after live membership validation");
});

test("client reference collision with another payload or guard is rejected", () => {
  assert.match(sql, /client_reference is already owned by another guard/i);
  assert.match(sql, /client_reference payload does not match the original manual entry/i);
  assert.match(sql, /using errcode = '23505'/i);
});

test("the stored client reference is normalized once and reused", () => {
  assert.match(
    sql,
    /v_client_reference := nullif\(trim\(coalesce\(p_client_reference, ''\)\), ''\)/i,
  );
  assert.match(sql, /'client_reference', v_client_reference/i);
});
