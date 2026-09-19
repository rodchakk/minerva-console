# ENTRY Observability v1

ENTRY Observability is the internal Minerva Console layer for answering whether
ENTRY is alive, what is failing, which communities are affected, and how much
provider usage is being consumed.

## Architecture

Observability v1 keeps five signal types separate:

- Operational telemetry: `system_event_log`, plus bounded product event streams
  such as `community_registration_events`, `entry_logs`, and onboarding message
  attempts.
- Incidents: derived at read time from recurring failures, plus a single
  CRITICAL failure that needs immediate operator visibility. No v1 incident
  lifecycle table is introduced.
- Audit: existing `superadmin_audit_log` and `community_admin_activity_log`.
- Security: existing `security_event_log`; security events are not duplicated
  into operational telemetry for dashboard convenience.
- Usage and cost: `entry_usage_ledger`, a focused provider usage ledger.

The dashboard uses `sa_get_entry_observability_v1(starts_at, ends_at,
community_id)` as its server-side read model. The RPC is superadmin-only,
bounded to 31 days, and returns summarized JSON for the browser.

The Communications drill-down uses
`sa_get_entry_notification_observability_v1(starts_at, ends_at, community_id,
limit)` as a separate superadmin-only read model. It is also bounded to 31 days,
clamps `limit` to 200 rows, and returns normalized notification events rather
than raw log rows.

## Signal Ownership

Use the canonical system for the question being answered:

- "Did an ENTRY operation succeed or fail?" belongs in operational telemetry.
- "Who changed something important?" belongs in audit.
- "Was authentication or access suspicious?" belongs in security.
- "What external provider usage was consumed?" belongs in the usage ledger.

Do not emit the same event into multiple systems unless each system owns a
different operator question.

## Critical Flows

The dashboard tracks stable ENTRY product capabilities rather than individual
endpoints or implementation details:

- Authentication
- Onboarding
- Resident access
- Gate access
- Communications
- Vision & recognition

Capability ownership:

- **Authentication** covers successful ENTRY sign-ins for active resident,
  guard, and community-admin memberships, plus future authentication failures.
- **Onboarding** covers community registration, conversion, resident activation,
  and activation outcomes.
- **Resident access** covers visitor passes, visit groups, self access, frequent
  access, and the resident-to-home context required by those operations.
- **Gate access** covers successful gate entries across QR, PIN, self, manual,
  and other access methods, plus explicit gate validation/rejection failures.
- **Communications** covers push, activation email, onboarding email, queue and
  worker health, and future delivery channels.
- **Vision & recognition** covers plate OCR, image queues, provider calls, and
  future image-recognition capabilities.

Health states are:

- Healthy: recent successful evidence exists and no meaningful current failure
  signal exists.
- Degraded: the capability has meaningful failure evidence or a current
  integrity/worker condition that requires review.
- Down: the capability has sustained failures or a current condition that makes
  it unusable for the selected scope.
- Idle: a workload-driven capability has no active work and no failure evidence.
  Idle is healthy-neutral and does not make global System status Unknown.
- Unknown: the capability should be observable, but there is insufficient
  evidence to make a health claim.

No telemetry must stay Unknown for continuous capabilities. Low-volume
communities are not marked Down only because nobody used a feature recently.

Onboarding and Vision & recognition are workload-driven. A completed onboarding
period or a quiet OCR queue should become Idle, not Degraded or Unknown.

Resident access includes a read-time integrity check for active residents. The
check requires a valid active primary-house relationship matching
`profiles.house_id`. Any invalid resident context immediately degrades Resident
access and produces a `RESIDENT_HOUSE_CONTEXT_INVALID` incident without waiting
for a user to discover the problem.

Communications includes the existing delivery evidence and the durable
notification-worker heartbeat. A stale or failing worker degrades the capability
even when older delivery events were successful. Direct activation emails sent
from Minerva Console emit privacy-minimized `ACTIVATION_EMAIL_SENT` /
`ACTIVATION_EMAIL_FAILED` telemetry.

The Communications row links to
`/products/entry/observability/notifications` with the current range and
community filter preserved. The route name remains for compatibility; the UI
surface is Communications.

Global system health is intentionally conservative:

1. Down if meaningful capability evidence says a continuous capability is Down.
2. Degraded if a capability is Degraded, or if a meaningful ERROR/CRITICAL
   incident is active.
3. Unknown if a non-Idle capability still lacks enough classified evidence for
   a system-wide health claim.
4. Healthy when every non-Idle capability has enough evidence and none is Down
   or Degraded.

QR, PIN, SELF, MANUAL, and frequent-access events remain distinguishable in
their source records even though the top-level capability is Gate access.

## Incident Grouping

Incidents are derived from failures in the selected time window. The read model
uses `error_fingerprint` when present. When a failure lacks a fingerprint, it
derives a fallback from normalized source, event type, error code, and message
shape. The fallback strips UUID-like and large numeric volatile values.

Recurring failures are shown as incidents. A single CRITICAL failure is also
shown immediately because it is operationally actionable on its own. A single
non-critical raw error remains raw telemetry, not an active incident.

When grouped rows contain mixed severities, the incident uses semantic severity
order: CRITICAL, then ERROR, then WARNING, then INFO. Text sorting is not valid
for severity.

## Usage And Cost Ledger

`entry_usage_ledger` records provider usage at the actual provider invocation
boundary.

Fields include:

- `community_id` for community attribution, or null only for genuinely global
  infrastructure usage.
- `operation`, `provider`, and `service_model`.
- measurable units: `quantity`, `image_count`, `input_tokens`, `output_tokens`,
  and `duration_ms`.
- provider reference: `provider_request_id` when safe.
- `pricing_version`, `estimated_cost`, and `currency`.
- `request_id` and `correlation_id`.
- sanitized metadata.

Provider prices must not be invented. If a provider returns exact usage, record
it. If cost can be calculated from an explicit pricing configuration, store the
cost and pricing version at write time. If pricing is not safely represented,
store the measurable usage and leave `estimated_cost` null.

The dashboard error rate uses only classified outcomes:
`failed_operations / known_outcome_operations`, where known outcomes are
successful plus failed operations. Unknown or informational events remain visible
as `unclassified_operations` but must not dilute the error rate.

Historical ledger rows preserve the pricing assumption used at the time. Do not
recalculate old rows with newer prices.

Retries are counted as separate ledger rows when they make separate billable or
potentially billable provider calls.

## OCR And Image Economics

OCR queue state and billable provider calls are separate. A queue row does not
necessarily equal one provider call. If one image causes an initial call plus two
billable retries, write three usage ledger rows.

ENTRY-OCR-001 brings the live `extract-plate-text` path under repository control.
The provider boundary now records Gemini OCR invocations with
`operation = 'image_ocr'`, `provider = 'google_gemini'`, the actual Gemini model,
`image_count = 1` per provider call, returned token counts from Google
`usageMetadata` when available, duration, outcome, request/correlation IDs,
community attribution, and a versioned standard-list pricing estimate.

Provider success and plate readability are intentionally different concepts. A
valid Gemini response that concludes `NO_PLATE` still proves the provider flow
worked and closes the queue job as `DONE`; it does not fabricate extracted plate
text.

Do not infer token usage from image count. Do not store the image, base64 image
data, OCR raw/full text, provider API keys, authentication values, or unnecessary
PII in telemetry. Product/domain tables own extracted content.

The OCR provider capability is exposed to the existing Observability screen by
`20260907182500_entry_ocr_observability_status.sql`. The original v1 read model
remains the internal base query, while the public superadmin RPC reports the
repository-controlled OCR provider as instrumented after ENTRY-OCR-001 is
released. Actual image/token/cost totals still come only from ledger rows; a
quiet system never fabricates usage.

Observability continues to use `plate_ocr_queue` for operational visibility:
pending, processing, failed, completed, retry/exhaustion, oldest-open, and
latest-completion signals. A fresh PENDING row is not degradation by itself.
Repeated failures or exhausted attempts can degrade Image OCR health. Old/stuck
open work can also degrade the flow independently of provider cost accounting.

OCR queue windows separate current state from history. Open `PENDING` and
`PROCESSING` rows are current operational state and stay visible even when their
`scheduled_at` retry time is in the future or the row was created before the
selected reporting window. Terminal `DONE` and `FAILED` rows are historical and
must fall inside the selected window using `coalesce(completed_at, scheduled_at,
created_at)`. Open rows use `created_at` capped at `now()` as their observed
time so future retries do not create future `lastObservedAt` values.

## Request And Correlation IDs

Reuse the existing `request_id` and `correlation_id` concepts. A request ID
identifies the immediate operation. A correlation ID links meaningful execution
chains, such as campaign -> notification worker -> provider call.

The goal is searchable operational context, not full distributed tracing.

## Privacy And Redaction

Never log:

- passwords, JWTs, refresh tokens, API keys, or session secrets
- activation PINs
- plaintext registration or Outrider tokens
- full private request payloads
- entire OCR text/documents
- unnecessary personal information

Metadata should be allowlisted, short, and operational.

Notifications drill-down never returns push tokens, recipient emails, message
bodies, image paths, image URLs, authorization headers, credentials, or raw
provider payloads. Error reasons are sanitized before leaving the RPC. Message
titles and profile display names may be used only as compact superadmin
diagnostic labels; bodies and recipient addresses remain excluded.

`PUSH_CLAIM_RPC_ERROR` has special semantics in the drill-down: it means the
worker failed before a queue row was selected. The event must not fabricate a
community, message, recipient, or lost notification. It reports
`provider_reached=false` and explains that the scheduled worker will invoke
again because no queue row was terminally failed.

A `community_message_push_queue` row already marked `failed` is different: it
is terminal queue evidence. The current claim RPC only selects `pending` rows,
so the drill-down must not describe failed queue rows as automatically retried.

"No active push tokens" is displayed as a non-provider deliverability condition,
not as an Expo outage.

Notification provider reachability is tri-state. `provider_reached=true` means
durable evidence proves provider contact, such as `NOTIFICATION_SENT` or a
persisted provider response/reference. `provider_reached=false` is reserved for
known pre-provider conditions such as `PUSH_CLAIM_RPC_ERROR`,
`PUSH_NO_ACTIVE_TOKENS`, and `SOS_PUSH_NO_GUARD_TOKENS`. Ambiguous delivery
failures remain `provider_reached=null`; the read model must not infer provider
non-reachability solely because `provider_response` is null.

Terminal push evidence has one canonical owner. When explicit
`NOTIFICATION_SENT` or `NOTIFICATION_FAILED` system telemetry exists for a
`community_message_push_queue` row through `entity_type` of
`community_message_push` or `community_message_push_queue` and
`entity_id = queue.id`, that explicit telemetry is the normalized operational
event. The queue row remains the fallback for historical deliveries that
predate the instrumentation, so one real queue delivery attempt produces one
drill-down event instead of a queue row plus duplicate telemetry.

The communications drill-down summary uses the same health semantics as the
parent Critical Flow helper `_entry_observability_flow_status_v1`. Failures can
drive Degraded or Down only under that shared failure-count and failure-rate
logic. Skipped rows, including `PUSH_NO_ACTIVE_TOKENS`, stay visible as
deliverability context but do not count as operational failures, so skipped-only
evidence remains Unknown and success plus skipped evidence remains Healthy.

## Dashboard Filters

The dashboard defaults to all active ENTRY communities. Operators can filter by
one active community and by Last 24 hours, Last 7 days, or Last 30 days. Every
section must respect the same filters.

## Instrumenting New ENTRY Features

When adding a new ENTRY feature:

1. Identify the signal owner before logging.
2. Add operational telemetry only at meaningful product or backend boundaries.
3. Include `community_id` whenever the activity is community-specific.
4. Include structured values in the owner table or `system_event_log.details`
   where practical; the current `system_event_log` table does not have top-level
   status, duration, error code, or fingerprint columns.
5. Record provider usage at the actual provider call, not at queue enqueue time.
6. Use `record_entry_usage_v1` from service-role code for provider usage.
7. Keep telemetry best-effort unless the product operation requires audit or
   security logging transactionally.
8. Add or update tests for health, incident grouping, filters, and redaction.

## Known Limitations

- HTTP request volume is not measured globally; the dashboard reports tracked
  operational events instead of fabricated request counts.
- Gemini OCR usage begins accumulating only after ENTRY-OCR-001 is released;
  historical OCR calls made before provider instrumentation are intentionally
  not backfilled or estimated.
- Provider costs are operational estimates from the pricing snapshot stored at
  invocation time, not invoice reconciliation; actual billing can differ because
  of provider tiers, credits, or later pricing changes.
- Critical flow health is conservative and will show Unknown until each flow has
  enough real telemetry.
- Some notification worker failures happen before a queue row is known. Those
  events can prove worker/claim failure and provider non-reachability, but they
  cannot prove which community, message, or recipient was affected.
- Recovery is inferred only from later success evidence in the same selected
  channel/window. It is not a full incident lifecycle or delivery trace.

## Follow-up Telemetry Opportunities

- Move the database-side worker invocation credential to Supabase Vault or an
  equivalent secret-managed mechanism.
- Bring the deployed `smart-service` Edge Function under repository source
  control before future runtime changes.
- Add non-sensitive worker invocation identifiers to queue-claim failures so
  future incidents can correlate scheduler, worker, and queue state without
  exposing provider payloads or credentials.


## Production hardening v2 — first-customer baseline

ENTRY Observability now treats the dashboard as a small operational control center rather than an error-only screen.

The stable capability taxonomy is Authentication, Onboarding, Resident access, Gate access, Communications, Vision & recognition, and Administration. Administration is workload-driven and can remain Idle when no administrative mutations occur.

### Durable incident lifecycle

Current-state monitors write privacy-minimized incident lifecycle rows with first seen, last seen, occurrence count, and resolved timestamps. A recovered condition therefore remains available for later investigation instead of disappearing when the live check returns Healthy.

Current monitors cover resident-house integrity, identity/membership integrity, expired active authorization, push readiness, stuck push/OCR queues, notification worker health, and failed scheduled jobs.

### Real-user performance

Authenticated ENTRY clients can report privacy-minimized performance metrics without sending content or credentials. The read model exposes p50, p95, and p99 measurements by surface, metric, platform, and app version.

The ENTRY admin web reports Web Vitals plus app, dashboard, access-history, and backend-readiness timings. Mobile ingestion is available through the same RPC contract; the production mobile client must use its actual source repository rather than the historical Gate-Project prototype.

### Communications delivery truth

An Expo push ticket means provider acceptance, not device delivery. ENTRY now stores only the Expo ticket id plus a SHA-256 token hash, checks Expo push receipts asynchronously, records delivered/failed outcomes, and deactivates tokens reported as DeviceNotRegistered.

Raw push tokens, message bodies, credentials, and raw provider payloads are excluded from the receipt ledger and observability read model.

### Workers, queues, and rollout readiness

The read model exposes scheduled worker state, queue depth/age/failures, database connection/cache indicators, mobile-push delivery, and per-community rollout signals.

Activated via queue is intentionally distinct from the total active resident count because legacy or manually created users may have no activation-queue traceability.

### Retention and noise control

Raw performance samples are retained for 45 days. Resolved lifecycle incidents are retained for 180 days. Routine Web Push completion heartbeats are no longer emitted for empty dispatcher cycles, and historical idle heartbeat noise is kept only for a short retention window.

Observability remains fail-open: telemetry must never block authentication, access creation, gate validation, administration, notification delivery, or OCR.


## Diagnostic bundles

ENTRY Observability includes a privacy-minimized diagnostic bundle workflow so production troubleshooting does not require manually searching every log source.

The dashboard action **Generate diagnostic** uses the current community scope and a selectable time window. It can produce:

- a concise troubleshooting summary for chat/support handoff
- a copyable JSON bundle
- a downloadable JSON file
- a saved diagnostic snapshot with a human reference such as `ENTRY-DIAG-YYYYMMDD-HHMM-XXXXXXXX`

The bundle consolidates the current observability read model, active and historical incidents, performance, infrastructure, rollout readiness, queue/worker state, and a bounded list of sanitized recent system events. Recent-event export deliberately exposes only operational metadata such as severity, module, event type, status, error code/fingerprint, duration, provider, and attempt count.

The bundle excludes passwords, activation PINs, QR tokens, raw push tokens, visitor names, email addresses, message bodies, and raw provider payloads.

Manual snapshots are retained for 180 days. ERROR/CRITICAL incident lifecycle transitions automatically capture 90-day snapshots when the incident is first detected and when it recovers. Automatic capture is fail-open: a diagnostic failure must never interfere with incident reconciliation or product operations.

Saved snapshot references are visible in the Observability dashboard. The snapshot reference is the preferred support handoff identifier because it points to a frozen view of ENTRY at the time of investigation.


### Diagnostic current-state truth

Diagnostic bundles intentionally separate **current operational state** from **historical signals inside the selected window**.

- `current_incidents` contains only durable incidents that are still open now.
- `historical_failure_signals` contains selected-window incident evidence that is no longer open.
- `triage_summary.system_status` represents the recent/current state used for troubleshooting.
- `triage_summary.window_status` preserves the historical selected-window assessment for context.
- Critical flows in the copied troubleshooting summary use the recent/current view; performance still describes the selected window.

Queue outcomes also distinguish **system failure** from **delivery unavailable**. For mobile push, `No active push tokens found for audience` means ENTRY processed the queue item but had no registered device to target. It is surfaced as `delivery_unavailable_count`, not `failed_count`. This prevents missing-device rollout state from being reported as a backend failure.
