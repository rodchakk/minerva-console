import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const migration = readFileSync(
  fileURLToPath(new URL("../supabase/migrations/20261020185000_fix_approved_contact_name_normalization.sql", import.meta.url)),
  "utf8",
);

test("approved names compare normalized input to normalized stored identity", () => {
  assert.match(
    migration,
    /v_unit\.status = 'confirmed'\s+and v_name is distinct from public\._cr_normalize_name_v1\(v_resident\.full_name\)/,
  );
});

test("contact corrections preserve approved name verbatim in DB and result", () => {
  assert.match(
    migration,
    /full_name = case when v_unit\.status = 'confirmed' then v_resident\.full_name else v_name end/,
  );
  assert.match(
    migration,
    /normalized_full_name = case when v_unit\.status = 'confirmed' then v_resident\.normalized_full_name else lower\(v_name\) end/,
  );
  assert.match(
    migration,
    /'full_name', case when v_unit\.status = 'confirmed' then v_resident\.full_name else v_name end/,
  );
});

test("approved-only casing differences do not record name changes in audit", () => {
  assert.match(
    migration,
    /if \(v_unit\.status = 'submitted' and v_name is distinct from v_resident\.full_name\)/,
  );
  assert.match(
    migration,
    /case when v_unit\.status = 'submitted' and v_name is distinct from v_resident\.full_name then 'full_name'::text end/,
  );
});

test("no queue-linked resident, approved name alteration, or unprivileged client gets edit access", () => {
  assert.match(migration, /if v_resident\.activation_queue_id is not null then/);
  assert.match(migration, /ENTRY_CR_APPROVED_IDENTITY_LOCKED/);
  assert.match(migration, /perform public\._cr_validate_actor_v1\(p_actor_user_id\)/);
  assert.match(migration, /grant execute on function public\.quick_edit_community_registration_resident_v1\([\s\S]*?\) to service_role;/);
});
