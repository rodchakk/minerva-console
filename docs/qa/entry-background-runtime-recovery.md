# ENTRY background recovery runbook

This runbook applies to the high-frequency background jobs isolated after the
October 1 Supabase degradation. It deliberately separates **code hardening**,
**database gating**, and **job reactivation** so that a merge never silently
turns all background load back on.

## Runtime modes

- **SEVERE** — no incident-relevant high-frequency background job is allowed to run.
- **DEGRADED** — only the bounded community mobile-push worker and mobile receipt worker may run.
- **NORMAL** — the runtime gate permits all configured jobs.

The migration initializes the control row in **SEVERE** and rewrites the eight
targeted cron commands through the runtime gate while preserving
`active=false`.

## Staged recovery order

1. Confirm Auth and REST are healthy and foreground ENTRY traffic is stable.
2. Confirm `net.http_request_queue` has no meaningful backlog and queue ages are acceptable.
3. Deploy the hardened Edge Function worker code before enabling its cron.
4. Keep runtime mode at **DEGRADED**.
5. Enable **community-message-push-worker** alone and observe Auth/REST errors,
   database latency, cron startup failures, queue age, and pg_net backlog.
6. Enable **entry-mobile-push-receipts** only after the first worker remains stable.
7. Move to **NORMAL** only with observed headroom.
8. Re-enable OCR, web push, stale sweeper, cleanup, observability reconciliation,
   and expiration **one at a time**, observing after every change.
9. If Auth/REST 5xx, cron startup timeouts, or connection pressure returns, set
   runtime mode back to **SEVERE** before investigating. Do not mass-toggle jobs.

## Rollback principle

The foreground product always wins over deferred background work. OCR, cleanup,
observability reconciliation, and noncritical dispatch can catch up later; Auth
and access verification must retain capacity first.
