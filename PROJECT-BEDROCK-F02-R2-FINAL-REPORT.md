# Project BedRock F02 Round 2 — Final Report

Decision: **READY FOR SECURITY REVIEW**

This decision is not merge approval, deployment approval, a production migration authorization, or a waiver approval.

## Scope and recovered state

- PR: #296 (Draft), `security/bedrock-f02-audience-isolation`.
- Recovered branch SHA: `2511993af997a930120cfe65288cffd6c2b023a3`.
- Original PR base: `0de583310ed527ff031e3dbda82c2231a69b4eff`.
- Current master integrated without rewriting history: `b17d9a3eb6bf7038914b965e86d4e6cc24a8efd8`.
- Round 2 initially existed only as three untracked local files and was absent from the remote PR.
- No F01 file or contract is changed by the final PR diff.

## Security outcome

Round 2 closes the legacy terminal-RPC vulnerability by making legacy and v2 ownership disjoint:

- `LEGACY_V25` is minted only by the public-only legacy claim RPC.
- `V2` provenance survives safe pre-provider retry even while no lease is active.
- Every v2 processing transition requires the current lease token.
- Legacy complete/fail cannot modify public or private v2 claims.
- A rollback to v25 cannot reclaim a pending public v2 retry.
- Only a leased v2 `PRE_PROVIDER` claim can be automatically requeued.
- Provider-contacted, legacy, and unclassified stale claims are quarantined without replay.

The review also found and fixed an inter-migration risk: migration 1 originally committed permissive legacy terminal functions before migration 2 replaced them. Migration 1 now independently requires the public/no-token legacy shape, so the deployment sequence is fail-closed at every commit boundary.

All F02 `SECURITY DEFINER` functions now use an empty pinned search path. Legacy and v2 worker RPCs explicitly revoke `PUBLIC`, `anon`, and `authenticated` execution and grant only `service_role`.

## Migrations and compatibility

1. `20261028032025_bedrock_f02_notification_audience_isolation.sql`
   - explicit audience snapshot and tenant-bound composite FK;
   - v2 lease/state-machine RPCs;
   - public-only legacy compatibility;
   - fail-closed migration-1 terminal predicates;
   - safe stale recovery and welcome recovery.
2. `20261028035327_f02_legacy_claim_lease_isolation.sql`
   - durable `claim_protocol` provenance;
   - protocol/lease shape constraints;
   - historical classification;
   - durable rollback protection.

Synthetic historical rows proved the expected mappings for public/private pending, public legacy processing, ambiguous private processing, sent, and no-token failed records. A mismatched message/community row is rejected by the composite FK. No historical migration file or migration ledger was rewritten.

## PostgreSQL evidence

Environment:

- isolated local Docker container `supabase_db_local-dev`;
- PostgreSQL 17.6;
- local-only port 54322;
- explicitly named disposable databases beginning with `bedrock_f02_r2_`;
- no remote database connection and no production data.

The staged suite passed in both the Windows local harness and the exact Linux CI runner. It verifies:

- installation order and the migration-1 commit window;
- constraints and tenant FK;
- legacy public claim/complete/fail;
- private and public v2 protection;
- correct, wrong, released, replaced, and replayed leases;
- cross-community quarantine;
- pre-provider retry and post-provider non-replay;
- legacy/v2/ambiguous sweeper behavior;
- rollback to v25;
- historical-data migration;
- ACL and search-path invariants; and
- two independent workers racing one queue row.

The concurrency test produced one v2 lease, one attempt, and zero rows for the second worker while the first held the claim lock.

## Repository quality gates

| Gate | F02 branch | Current master | Classification |
|---|---:|---:|---|
| Focused worker/welcome tests | 28/28 pass | n/a | PASS |
| PostgreSQL 17 staged suite | pass | n/a | PASS |
| Deno check | pass | n/a | PASS |
| TypeScript after `next typegen` | pass | pass | PASS |
| Production build | pass | pass | PASS |
| Full lint | 2 errors, 15 warnings | 2 errors, 15 warnings | PRE-EXISTING FAILURE |
| Global Node suite | 690/737 pass | 681/725 pass | 44 shared; 3 branch-only meta-test failures |

All 44 current-master test failures reproduce on the branch. The three branch-only failures are scope/meta-tests whose assertions reject any ENTRY/migration change (`Console access changes do not spill...`, `no ENTRY authorization...`, and `Seshat web MVP adds no database migration`). They do not exercise F02 behavior. A waiver or future redesign may be appropriate, but this report does not approve either.

The original inherited baseline of 42 remains identifiable; current master has two additional failing tests introduced after the PR base.

## CI and automation safety

- The added CI job uses a disposable PostgreSQL 17 service and synthetic credentials/data.
- Repository workflows deploy nothing and run push jobs only on `master`; this branch push triggers PR validation.
- The connected Vercel integration creates a preview, not a production deployment.
- PR #296 must remain Draft.
- Round 2 CI must be green before any merge decision.

## Residual risks

- Migration DDL validates a composite FK and can take write locks; use the documented controlled maintenance procedure.
- A provider-contact marker written immediately before the HTTP request favors duplicate prevention over automatic recovery and can suppress an unsent notification after a narrow crash.
- `UNKNOWN_OUTCOME` requires manual reconciliation and must never be blindly requeued.
- v25 rollback intentionally pauses private delivery.
- Repository-wide lint/test debt remains and requires an owner decision on waiver policy.

## Recommendation

Send PR #296 for independent security review after Round 2 CI completes. Do not merge or deploy from this report. Production rollout requires separate approval, read-only preflight evidence, scheduler coordination, and the runbook in `docs/bedrock-f02-notification-audience-isolation.md`.

## Operations not performed

- No merge to master.
- No production deployment.
- No production migration or RLS change.
- No production data read/write.
- No notification, email, WhatsApp message, or real provider call.
- No credential rotation or real PIN/token use.
