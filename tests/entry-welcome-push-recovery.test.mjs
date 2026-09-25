import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const migration = read(
  "supabase/migrations/20260925052000_fix_entry_welcome_push_recovery.sql",
);

test("late push-token registration can replay an old targeted welcome without reopening the general 24h window", () => {
  assert.match(
    migration,
    /q\.enqueue_source = 'welcome_token_recovery'[\s\S]*q\.updated_at >= now\(\) - interval '24 hours'/,
  );
  assert.match(migration, /m\.target_user_id is not null/);
  assert.match(
    migration,
    /exists \([\s\S]*from public\.user_push_tokens upt[\s\S]*upt\.user_id = m\.target_user_id[\s\S]*upt\.is_active = true/,
  );
  assert.match(
    migration,
    /q\.created_at >= now\(\) - interval '24 hours'[\s\S]*m\.published_at >= now\(\) - interval '24 hours'/,
  );
});

test("welcome recovery explicitly marks and refreshes retry state", () => {
  assert.match(migration, /create or replace function public\.ensure_welcome_push_after_token/);
  assert.match(migration, /select q\.status, q\.updated_at/);
  assert.match(migration, /v_queue_status = 'failed'/);
  assert.match(
    migration,
    /v_queue_status = 'pending'[\s\S]*v_queue_updated_at[\s\S]*interval '24 hours'/,
  );
  assert.match(migration, /enqueue_source = 'welcome_token_recovery'/);
  assert.match(migration, /attempts = 0/);
  assert.match(migration, /claimed_at = null/);
  assert.match(migration, /completed_at = null/);
});

test("stale sweeper gives old pending rows a terminal path", () => {
  assert.match(
    migration,
    /with old_pending as \([\s\S]*q\.status = 'pending'[\s\S]*q\.updated_at < now\(\) - interval '24 hours'/,
  );
  assert.match(migration, /failed_stale_old_pending/);
  assert.match(migration, /old_pending_swept/);
});

test("migration narrowly recovers already-stranded welcome rows with active tokens", () => {
  assert.match(
    migration,
    /update public\.community_message_push_queue q[\s\S]*m\.title = 'Bienvenido\(a\) a ENTRY'/,
  );
  assert.match(migration, /m\.target_user_id is not null/);
  assert.match(
    migration,
    /exists \([\s\S]*from public\.user_push_tokens upt[\s\S]*upt\.community_id = m\.community_id[\s\S]*upt\.is_active = true/,
  );
});
