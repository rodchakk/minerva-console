import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const base = new URL('../supabase/migrations/20261112190000_entry_person_name_capitalization.sql', import.meta.url);
const edit = new URL('../supabase/migrations/20261112190100_entry_quick_edit_display_name_compatibility.sql', import.meta.url);
const backfill = new URL('../supabase/maintenance/20261112_entry_person_name_historical_backfill.sql', import.meta.url);
const migration = readFileSync(base, 'utf8');
const compat = readFileSync(edit, 'utf8');
const repair = readFileSync(backfill, 'utf8');

test('display write guard covers all six intended human-name fields', () => {
  for (const table of ['profiles', 'resident_activation_queue', 'community_registration_residents', 'resident_invites', 'resident_favorites', 'houses']) {
    assert.match(migration, new RegExp("TG_TABLE_NAME = '"+table+"'|on public\\."+table, 'i'));
  }
  assert.match(migration, /NEW\.normalized_full_name\s*:=\s*public\._cr_normalize_name_v1\(NEW\.full_name\)/);
});

test('search normalizers are not overwritten by display migration', () => {
  assert.doesNotMatch(migration, /create\s+or\s+replace\s+function\s+public\._cr_normalize_name_v1\s*\(/i);
  assert.doesNotMatch(migration, /create\s+or\s+replace\s+function\s+public\._cr_conversion_normalize_name_v1\s*\(/i);
});

test('approved contact edits compare identities ignoring display case', () => {
  assert.match(compat, /_cr_normalize_name_v1\(v_name\)\s+is distinct from\s+public\._cr_normalize_name_v1\(v_resident\.full_name\)/i);
  assert.match(compat, /v_name\s*:=\s*public\.entry_display_person_name_v1\(p_full_name\)/i);
  assert.match(compat, /v_unit\.status = 'confirmed' then v_resident\.full_name else v_name/i);
});

test('historical repair is manually gated and transactional with rollback snapshot', () => {
  assert.match(repair, /^begin;/m);
  assert.match(repair, /^commit;/m);
  assert.match(repair, /private\.entry_person_name_case_backup_20261112/);
  assert.match(repair, /old_normalized_full_name/);
  assert.match(repair, /raise exception 'Name repair incomplete/);
  assert.doesNotMatch(migration, /update\s+public\.(profiles|resident_activation_queue|community_registration_residents)\b/i);
});

test('migration only alters human-readable name columns', () => {
  assert.doesNotMatch(migration, /NEW\.(email|phone|username|house_id|role|user_id|community_id)\s*:=/i);
});
