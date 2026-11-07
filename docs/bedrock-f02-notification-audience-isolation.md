# PROJECT BEDROCK F02 — notification audience isolation

Status: isolated implementation for review. This document does not authorize a production migration, Edge Function deployment, merge, or notification send.

## Security invariant

A queue row may reach Expo only after the database atomically resolves an explicit audience from the tenant-bound message:

- `PUBLIC`: every recipient must be an active `ADMIN` or `RESIDENT` of the row's `community_id`, and every token query is scoped to that same community.
- `PRIVATE`: `target_user_id` must be non-null, must be an active member of the same community, and token lookup is restricted to that user and community.
- Invalid or incomplete audience data is terminally quarantined. No error path converts a private or invalid audience into a public audience.

The composite foreign key `(message_id, community_id) -> community_messages(id, community_id)` prevents a queue row from associating a message with another community. The v2 claim returns the resolved audience and a unique claim lease in the same transaction that changes the row to `processing`.

## Delivery state machine

| Stage | Meaning | Automatic transition allowed |
|---|---|---|
| `PRE_PROVIDER` | v2 lease exists; Expo has not been marked as contacted | Bounded retry with backoff while current, or terminal `FAILED` |
| `PROVIDER_CONTACTED` | durable boundary written before the HTTP request | `CONFIRMED`, `FAILED`, or `UNKNOWN_OUTCOME`; never back to pending |
| `UNKNOWN_OUTCOME` | Expo may have accepted the request, but the result cannot be proved | No automatic retry |
| `CONFIRMED` | Expo returned a complete accepted ticket set and receipt tracking was persisted | Terminal |
| `FAILED` | deterministic invalid audience/no-token/rejection/exhaustion outcome | Terminal, except the narrow welcome recovery below |

The marker is deliberately conservative: a process crash after writing `PROVIDER_CONTACTED` but before opening a network connection produces `UNKNOWN_OUTCOME`. This sacrifices availability rather than risk a duplicate or an audience-expanding replay.

## Recovery contract

1. A v2 claim carries a non-null `claim_token`. Every state-changing RPC requires both `queue_id` and that lease token.
2. Lookup, validation, or other failures before provider contact call `retry_community_message_push_pre_provider_v2`. Retries are capped at five attempts and use bounded exponential backoff.
3. The sweeper may requeue only stale `PRE_PROVIDER` rows with a v2 lease and a still-eligible message. Legacy claims, provider-contacted claims, and ambiguous claims are never replayed.
4. HTTP timeouts, non-complete responses, malformed ticket sets, receipt-persistence errors after acceptance, and post-contact worker failures become `UNKNOWN_OUTCOME`.
5. A receipt unique key on `(queue_id, token_hash)` and a preflight receipt lookup block a known token from being submitted twice for the same queue row.
6. Expo ticket acceptance is not device delivery. The existing receipt worker remains responsible for later delivery receipt resolution.

### Welcome recovery

`ensure_welcome_push_after_token` may reopen a welcome row only when all of these are true:

- the previous terminal failure code is `NO_ACTIVE_TOKENS`;
- the row is `FAILED`;
- `provider_attempted_at` is null;
- `provider_response` is null; and
- an active token and active community membership now exist.

An old pending welcome created by the recovery flow may also be refreshed only when no provider evidence exists. `PROVIDER_CONTACTED` and `UNKNOWN_OUTCOME` are explicitly blocked from automatic welcome replay.

## Compatibility

- The existing `claim_pending_community_message_pushes` signature is retained for worker v25, but it can claim only public messages after this migration.
- Existing v25 `complete_community_message_push` and `fail_community_message_push` calls remain available, but migration 1 already restricts them to public, no-token processing rows. This closes the transaction boundary before migration 2 commits.
- Migration 2 adds durable `claim_protocol` provenance. `LEGACY_V25` can be minted only by the legacy public claim RPC; every v2 processing transition requires `claim_protocol = 'V2'` and the current lease token.
- A safe v2 pre-provider retry retains `V2` provenance while its lease is released. A rolled-back v25 worker therefore cannot reinterpret a public v2 retry as new legacy work.
- Worker v26 uses only `claim_pending_community_message_pushes_v2`; it has no legacy fallback. Deploying v26 before the migration therefore fails closed with no provider call.
- During the migration-to-worker gap, public notifications can continue through v25; private notifications remain pending. This is an intentional safe degradation.
- Rolling the worker back to v25 is safe only while the F02 migration remains installed. Private delivery pauses; it must not regain legacy claim eligibility.

## Required production preflight

Run these checks read-only and retain their results with the change record:

1. Confirm there are no `(message_id, community_id)` mismatches between queue rows and messages.
2. Confirm there are no duplicate `(queue_id, token_hash)` receipt pairs.
3. Count pending, processing, failed, and sent rows by age and identify existing stale `processing` rows.
4. Confirm all private message targets are active members of their message community, or accept that they will be quarantined.
5. Confirm the production branch and Edge Function digest that will be deployed.
6. Confirm the notification scheduler can be paused and resumed independently.

The DDL creates indexes/constraints and validates a foreign key. Although the observed tables are small, production rollout must still account for write locks and run during a controlled maintenance window.

## Gradual deployment procedure

No step below is authorized by this implementation PR alone.

1. Pause the `smart-service` scheduler and wait for active invocations to finish. Do not mutate claimed rows to force a drain.
2. Record the preflight counts and export identifiers for any existing `processing` rows. They will be classified conservatively during migration.
3. Apply the database migration. If it fails, rely on the transactional DDL rollback; do not deploy v26.
4. Verify columns, constraints, indexes, grants, RPC signatures, and that the legacy claim returns public rows only.
5. Deploy the reviewed v26 Edge Function without enabling the scheduler yet.
6. Run an approved non-production synthetic smoke test. Do not use real user content or real Expo tokens.
7. Enable a single bounded worker invocation (`limit = 1`) and observe claim stage, audience type, token count, Expo outcome, receipts, and worker health without logging token values or message content.
8. Resume the scheduler at the existing cadence. Monitor `UNKNOWN_OUTCOME`, transition failures, no-token failures, queue age, and duplicate receipt conflicts.
9. Increase throughput only after the observation window shows no cross-community lookup, claim buildup, or unexpected ambiguity.

## Rollback

### Before the database migration

No code has changed in production. Keep the scheduler paused only as long as necessary, then resume the existing system.

### After migration, before v26

Resume v25 only if public-only delivery is acceptable. Public rows continue; private rows remain pending. Keep the migration installed.

### After v26 deployment

1. Pause the scheduler and wait for active v26 invocations to finish.
2. Inspect all `processing`, `PROVIDER_CONTACTED`, and `UNKNOWN_OUTCOME` rows. Do not requeue them automatically.
3. Roll the Edge Function back to the known v25 digest while retaining the F02 migration.
4. Resume only public delivery. Private rows remain pending until v26 is corrected and redeployed.
5. Prefer a forward database fix. Do not remove the public-only legacy bridge or the tenant foreign key while v25 can run.

The database migration must not be rolled back while v26 is deployed. A database rollback that restores the old legacy claim would reintroduce F02 and is therefore an incident-level `NO-GO` action.

## Regression coverage

The repository tests cover:

- explicit public/private audience validation and invalid-audience quarantine;
- community-scoped private membership and token lookup;
- fail-closed mixed batches;
- pre-provider lookup failure and bounded retry;
- provider timeout and unknown-outcome quarantine;
- partial acceptance and receipt persistence;
- prior-receipt duplicate blocking and receipt idempotency;
- concurrent synthetic worker invocations with a single atomic claim;
- legacy v25 public-only compatibility;
- state-machine/sweeper invariants; and
- safe versus blocked welcome recovery.

Both migrations were also executed in order against isolated PostgreSQL 17.6 databases with synthetic historical rows. Behavioral checks cover:

- the migration-1 commit window before migration 2;
- composite tenant-FK rejection and protocol-shape constraints;
- legacy public claim/complete/fail compatibility;
- private and public v2 lease isolation from legacy terminals;
- wrong, released, replaced, and replayed lease rejection;
- invalid cross-community private audience quarantine;
- safe pre-provider retry and non-replayable post-provider failure;
- legacy, v2, and ambiguous stale sweeper behavior;
- rollback to v25 with a pending public v2 retry;
- function ACLs and empty pinned `SECURITY DEFINER` search paths; and
- two independent PostgreSQL sessions racing for one row, producing exactly one lease and one attempt.

The same staged sequence is wired into CI through `supabase/tests/run-bedrock-f02-r2.sh` and a disposable PostgreSQL 17 service.

## Residual risks

- The conservative pre-network `PROVIDER_CONTACTED` marker can suppress a notification if the worker crashes before the request actually leaves the process.
- A multi-chunk audience with an ambiguous early chunk leaves later unsent chunks unretried. This is intentional safety behavior but may reduce delivery completeness.
- Expo ticket acceptance does not prove device receipt; the existing receipt workflow and operational reconciliation remain required.
- An `UNKNOWN_OUTCOME` needs manual reconciliation. Operators must never resolve it by blindly resetting the row to pending.
- The v25 rollback mode pauses all private notification delivery.
- Migration DDL can briefly lock the affected tables; production timing and lock monitoring are required.

## Merge gate

Current decision: `READY FOR SECURITY REVIEW`; this is not merge or deployment approval.

F02-specific validation is green, but the mandatory repository-wide gates are not:

- F02 worker/welcome regression command: 28 passed, 0 failed.
- Staged PostgreSQL 17.6 migration/protocol/concurrency rehearsal: passed.
- Edge Function typecheck (`deno check`): passed.
- Next.js production build: passed.
- TypeScript check after Next generated route types: passed.
- Full test suite after current-master integration: 737 total, 690 passed, 47 failed.
- Full test suite on untouched current `origin/master` (`b17d9a3`): 725 total, 681 passed, 44 failed.
- All 44 current-master failures are reproduced on the branch. Three branch-only failures are stale scope/meta-tests that reject any ENTRY migration or migration-bearing branch. The original 42-failure inherited baseline therefore remains, with two additional failures already present on current master. No F02 behavioral test regressed.
- Full lint on this branch and untouched `origin/master`: the same 2 errors and 15 warnings.
- Supabase CLI is not installed globally. Migration parsing and behavior were validated directly with `psql -v ON_ERROR_STOP=1`, and current Supabase function-security guidance was applied.

The branch does not introduce an F02 functional, build, typecheck, Deno, or lint regression. The three branch-only global-suite failures are test-contract debt and require a repository-owner waiver or later test redesign; this report does not approve that waiver. Green PR CI is still required after the Round 2 push. Production migration and Edge deployment always require separate explicit authorization and the runbook above.

## PR scope

The intended PR is limited to:

- two ordered forward database migrations: the audience/state-machine foundation and the durable legacy/v2 protocol isolation layer;
- the `smart-service` worker upgrade to v2;
- focused defensive regression tests, CI wiring, and one historical test allowlist entry for the explicitly authorized F02 migration; and
- this deployment/recovery runbook.

It must not contain F01 changes, unrelated UI fixes, production configuration changes, scheduler changes, secrets, real tokens, or generated build output.
