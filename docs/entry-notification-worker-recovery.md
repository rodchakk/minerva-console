# ENTRY notification worker recovery telemetry

## Purpose

ENTRY Notifications previously recorded delivery evidence and worker claim failures, but a later successful empty worker cycle left no durable recovery evidence. That meant a transient `PUSH_CLAIM_RPC_ERROR` could remain operationally ambiguous even after the worker was healthy again.

## Design

- `smart-service` is now stored under `supabase/functions/smart-service/index.ts` and remains behavior-compatible with the deployed worker.
- Every authorized worker invocation records a compact cycle result through `record_entry_notification_worker_cycle_v1`.
- Worker-cycle success is separate from notification-delivery success. An empty successful cycle proves the worker can claim/complete its loop, but does not pretend Expo delivered a notification.
- Durable health is stored as one row in `entry_notification_worker_health`; heartbeats do not create a log row every two minutes.
- A low-volume `PUSH_WORKER_RECOVERED` system event is emitted only when a successful cycle follows an unresolved worker failure.
- The latest pre-existing `PUSH_CLAIM_RPC_ERROR` is backfilled on migration so the incident that motivated this work can be marked recovered by the first later successful cycle.
- A heartbeat is considered stale after six minutes. The scheduler currently runs every two minutes, so this tolerates two missed cycles before showing degraded worker health.

## Console

`ENTRY observability / Notifications` shows a dedicated worker health panel with:

- current worker status;
- last successful cycle;
- last failure;
- consecutive failures;
- last claimed/processed counts;
- recovery state and recovery timestamp.

This panel is intentionally separate from the notification event success/failure summary.

## Privacy and safety

Worker health stores only bounded operational metadata. It does not store push content, recipient emails, phone numbers, Expo tokens, authorization headers, credentials, or raw provider payloads.

The malformed-claim-row logger also no longer records the raw queue row; it records only safe presence flags and attempt count.

## Remaining hardening

Move the database-side worker invocation credential from the current embedded invocation path into Supabase Vault or another managed secret mechanism. That credential must never be copied into observability output or repository source.
