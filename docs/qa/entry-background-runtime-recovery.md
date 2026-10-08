# ENTRY background recovery runbook

This runbook applies to the high-frequency background jobs isolated after the
October 1 Supabase degradation. It deliberately separates **code hardening**,
**database gating**, and **job reactivation** so that a merge never silently
turns all background load back on.

## Runtime modes

- **SEVERE** — no incident-relevant high-frequency background job is allowed to run.
- **DEGRADED** — only the bounded community mobile-push worker and mobile receipt worker may run.
- **RECOVERY** — staged, reversible recovery mode. It keeps the bounded communications workers, database maintenance, OCR retry, and—only after the final hardening stage—the bounded Web Push dispatcher available. Individual cron jobs can still remain inactive while permitted by the gate.
- **NORMAL** — the runtime gate permits all configured jobs.

Every allowed job also takes a transaction-scoped advisory lock. If the previous
invocation is still running, the next cron tick exits successfully with
`reason=overlap_guard` instead of stacking another copy of the same workload.

## Staged recovery order

1. Confirm Auth and REST are healthy and foreground ENTRY traffic is stable.
2. Confirm `net.http_request_queue` has no meaningful backlog and queue ages are acceptable.
3. Deploy the hardened Edge Function worker code before enabling its cron.
4. Keep runtime mode at **DEGRADED**.
5. Enable **community-message-push-worker** alone and observe Auth/REST errors,
   database latency, cron startup failures, queue age, and pg_net backlog.
6. Enable **entry-mobile-push-receipts** only after the first worker remains stable.
7. After a longer stable window, move to **RECOVERY**, not **NORMAL**.
8. Re-enable database-only jobs in this order: **entry-observability-incident-reconcile**,
   **community-message-push-stale-sweeper**, **cleanup-edge-rate-limits**, then
   **expire-stale-records**.
9. After those remain stable, permit and activate **entry-plate-ocr-queue** while staying
   in **RECOVERY**. This worker is bounded to three queued items per run and is needed
   to retry OCR work left PENDING after transient provider failures.
10. Harden **entry-web-push-dispatch** before the final recovery stage: automatic
    dispatch requests should claim at most 10 deliveries, application requests are
    capped at 25, provider sends have an 8 second timeout, and the existing advisory
    lock prevents overlapping cron ticks.
11. Permit Web Push in **RECOVERY**, but keep its cron inactive until the hardened
    application code is deployed. Run one manual gated cycle, verify queue/provider
    outcomes and system headroom, then activate the cron as the final isolated job.
12. Keep **RECOVERY** after all jobs are restored until a separate stability decision
    is made. Moving to **NORMAL** is not required merely to restore service.
13. If Auth/REST 5xx, cron startup timeouts, or connection pressure returns, set
    runtime mode back to **SEVERE** before investigating. Do not mass-toggle jobs.

## Rollback principle

The foreground product always wins over deferred background work. OCR, cleanup,
observability reconciliation, and noncritical dispatch can catch up later; Auth
and access verification must retain capacity first.
