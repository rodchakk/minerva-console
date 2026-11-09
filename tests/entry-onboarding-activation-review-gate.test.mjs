import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const read = (path) => readFileSync(join(process.cwd(), path), "utf8");
const migration = read(
  "supabase/migrations/20261107031000_require_explicit_activation_queue_review.sql",
);

test("readiness does not mistake invited or PIN-generated residents for a reviewed queue", () => {
  assert.match(
    migration,
    /v_activation_done\s*:=\s*\(v_queue_total = v_queue_activated\)\s+or v_review\.activation_queue_reviewed_at is not null\s+or v_review\.completed_at is not null;/,
  );
  assert.doesNotMatch(
    migration,
    /or \(v_queue_pending = 0 and v_queue_failed = 0\)/,
  );
  assert.match(migration, /'queue_total', v_queue_total/);
  assert.match(migration, /'pin_generated', v_queue_pin_generated/);
  assert.match(migration, /'activated', v_queue_activated/);
});

test("readiness change preserves the seven-step contract and does not modify resident queue rows", () => {
  assert.match(migration, /create or replace function public\.get_community_onboarding_progress_v1\(p_community_id uuid\)/);
  assert.match(migration, /stable security definer/);
  assert.match(migration, /'key', 'activation_queue'/);
  assert.match(migration, /'key', 'final_review'/);
  assert.match(migration, /'onboarding_status', v_status/);
  assert.doesNotMatch(migration, /(?:update|delete from|insert into)\s+(?:public\.)?resident_activation_queue/i);
});

test("queue review and final completion remain separate superadmin RPC actions", () => {
  const actions = read("features/entry/communities/onboardingActions.ts");
  assert.match(actions, /export async function markActivationQueueReviewedAction/);
  assert.match(actions, /export async function completeCommunityOnboardingAction/);
  assert.match(actions, /await requireSuperadmin\(\)/);
  assert.match(actions, /"mark_activation_queue_reviewed_v1"/);
  assert.match(actions, /"complete_community_onboarding_v1"/);
});

test("both review entry points refresh readiness after successful acknowledgement", () => {
  const setup = read("features/entry/communities/CommunityOnboardingReadinessPanel.tsx");
  const queue = read("features/entry/activation/ActivationQueueReviewAcknowledge.tsx");

  for (const source of [setup, queue]) {
    assert.match(source, /useRouter/);
    assert.match(source, /const actionResult = await markActivationQueueReviewedAction\(communityId\);[\s\S]*if \(actionResult\.success\) \{\s*router\.refresh\(\);\s*\}/);
  }
  assert.match(setup, /const canMarkActivationQueueReviewed =\s*!!activationQueueTask && !activationQueueTask\.done/);
  assert.match(queue, /Mark queue reviewed/);
});
