import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("activation consumers use the v2 two-component credential", async () => {
  const [validateRoute, completeRoute, page, emailActions, pinActions, createUsers] = await Promise.all([
    read("app/activate/validate/route.ts"),
    read("app/activate/complete/route.ts"),
    read("app/activate/page.tsx"),
    read("features/entry/activation/emailActions.ts"),
    read("features/entry/activation/pinActions.ts"),
    read("features/entry/activation/createUserActions.ts"),
  ]);

  assert.match(validateRoute, /validate_resident_activation_pin_v2/);
  assert.match(completeRoute, /complete_resident_activation_pin_v2/);
  assert.match(validateRoute, /p_activation_id:\s*activationId/);
  assert.match(completeRoute, /p_activation_id:\s*activationId/);
  assert.match(pinActions, /generate_resident_activation_pins_locked_v2/);
  assert.match(createUsers, /complete_resident_activation_pin_v2/);
  assert.match(createUsers, /p_activation_id:\s*item\.activation_id/);
  assert.match(page, /params\.get\("id"\)/);
  assert.match(page, /autoComplete="one-time-code"/);
  assert.doesNotMatch(emailActions, /activate\?pin=/);
  assert.match(emailActions, /activate\?id=/);
});

test("onboarding worker sends v2 handles without putting the PIN in the URL", async () => {
  const worker = await read("supabase/functions/send-onboarding-email-batch/index.ts");
  assert.match(worker, /worker_generate_resident_activation_pin_v2/);
  assert.match(worker, /pinRow\.activation_id/);
  assert.doesNotMatch(worker, /activate\?pin=/);
  assert.match(worker, /activate\?id=/);
});

test("v2 migration binds attempts to an opaque handle and keeps secrets out of audit identifiers", async () => {
  const migration = await read(
    "supabase/migrations/20261031010000_bedrock_f03_activation_credential_v2.sql",
  );
  assert.match(migration, /activation_handle uuid/);
  assert.match(migration, /failed_attempts = failed_attempts \+ 1/);
  assert.match(migration, /for update/);
  assert.match(migration, /visible_code = null/);
  assert.match(migration, /credential:' \|\| v_credential\.id::text/);
  assert.match(migration, /new\.credential_version := 1/);
  assert.match(migration, /new\.activation_handle := null/);
  assert.doesNotMatch(migration, /identifier[^\n]*\|\|[^\n]*v_pin/);
  assert.doesNotMatch(migration, /sqlerrm[^\n]*metadata|metadata[^\n]*sqlerrm/i);
});

test("activation endpoints disable referrer propagation and caching", async () => {
  const config = await read("next.config.ts");
  assert.match(config, /source:\s*"\/activate\/:path\*"/);
  assert.match(config, /Referrer-Policy[\s\S]*no-referrer/);
  assert.match(config, /Cache-Control[\s\S]*no-store/);
});

test("web routes add a candidate-independent, keyed network budget", async () => {
  const [rateLimit, validateRoute, completeRoute] = await Promise.all([
    read("features/entry/communityRegistration/public/rateLimit.ts"),
    read("app/activate/validate/route.ts"),
    read("app/activate/complete/route.ts"),
  ]);
  assert.match(rateLimit, /activationValidateNetwork/);
  assert.match(rateLimit, /activationCompleteNetwork/);
  assert.match(rateLimit, /createHmac\("sha256"/);
  assert.match(rateLimit, /"resident-activation"/);
  assert.doesNotMatch(rateLimit, /activationValidateNetwork[^\n]*(pin|activationId)/i);
  assert.match(validateRoute, /enforceActivationValidateRateLimit\(request\)/);
  assert.match(completeRoute, /enforceActivationCompleteRateLimit\(request\)/);
});
