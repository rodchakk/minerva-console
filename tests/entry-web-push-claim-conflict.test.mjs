import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260910071500_fix_entry_web_push_claim_conflict.sql"),
  "utf8",
);

test("ENTRY Web Push claim migration targets the delivery uniqueness constraint explicitly", () => {
  assert.match(
    migration,
    /on conflict on constraint entry_web_push_deliveries_event_id_subscription_id_key\s+do nothing/i,
  );
  assert.doesNotMatch(migration, /on conflict \(event_id, subscription_id\) do nothing/i);
});
