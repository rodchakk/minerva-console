# ENTRY background recovery runbook

This runbook applies to the high-frequency background jobs isolated after the
October 1 Supabase degradation. It deliberately separates **code hardening**,
**database gating**, and **job reactivation** so that a merge never silently
turns all background load back on.

## Runtime modes

- **SEVERE** — no incident-relevant high-frequency background job is allowed to run.
- **DEGRADED** — only the bounded community mobile-push worker and mobile receipt worker may run.
- **RECOVERY** — keeps those two workers available and additionally permits database-only maintenance: observability reconciliation, stale push sweeping, edge rate-limit cleanup, and stale-record expiration. OCR and web-push fan-out remain blocked.
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
   **expire-stale-records**. Keep OCR and web push disabled while this stage is observed.
9. Move to **NORMAL** only with observed headroom, then restore
   **entry-web-push-dispatch** and **entry-plate-ocr-queue** one at a time.
10. If Auth/REST 5xx, cron startup timeouts, or connection pressure returns, set
    runtime mode back to **SEVERE** before investigating. Do not mass-toggle jobs.

## Rollback principle

The foreground product always wins over deferred background work. OCR, cleanup,
observability reconciliation, and noncritical dispatch can catch up later; Auth
and access verification must retain capacity first.
