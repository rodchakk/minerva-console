import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase/migrations/20261106090000_entry_unit_relationships_mvp.sql", import.meta.url),
  "utf8",
);
const fixture = readFileSync(
  new URL("../supabase/tests/fixtures/entry-unit-relationships.sql", import.meta.url),
  "utf8",
);

test("unit links and responsibilities are separate, tenant-scoped, historical associations", () => {
  assert.match(migration, /create table public\.entry_unit_links/i);
  assert.match(migration, /create table public\.entry_unit_responsibilities/i);
  assert.match(migration, /foreign key \(unit_a_id, community_id\)/i);
  assert.match(migration, /foreign key \(unit_b_id, community_id\)/i);
  assert.match(migration, /foreign key \(community_id, user_id\)[\s\S]*?community_members\(community_id, user_id\)/i);
  assert.match(migration, /where ended_at is null/i);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /force row level security/i);
  assert.match(migration, /revoke all on function[\s\S]*?from public,anon/i);
  assert.doesNotMatch(migration, /update public\.house_residents/i);
  assert.doesNotMatch(migration, /update public\.profiles/i);
});

test("PostgreSQL fixture covers reversals, same-community integrity and safe rename", () => {
  for (const phrase of ["reverse link duplicated", "self-link accepted", "cross-community link accepted", "missing membership accepted", "relink history missing", "rename altered relationship", "entry-unit-relationships fixture PASS"]) {
    assert.ok(fixture.includes(phrase), `Missing fixture assertion: ${phrase}`);
  }
});
