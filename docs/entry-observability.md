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

## Signal Ownership

Use the canonical system for the question being answered:

- "Did an ENTRY operation succeed or fail?" belongs in operational telemetry.
- "Who changed something important?" belongs in audit.
- "Was authentication or access suspicious?" belongs in security.
- "What external provider usage was consumed?" belongs in the usage ledger.

Do not emit the same event into multiple systems unless each system owns a
different operator question.

## Critical Flows

The dashboard tracks:

- Create pass
- Validate QR
- Resident login
- Registration
- Image OCR
- Notifications

Health states are:

- Healthy: recent successful evidence exists and no meaningful current failure
  signal exists.
- Degraded: the flow has successes but elevated recent failures, or has a small
  amount of failure evidence without enough evidence to call it down.
- Down: recent attempts are consistently failing.
- Unknown: there is insufficient telemetry.

No telemetry must stay Unknown. Low-volume communities are not marked Down only
because no one used a feature recently.

The v1 SQL helper `_entry_observability_flow_status_v1` centralizes the basic
thresholds. If thresholds change, update that helper and this document together.

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

Historical ledger rows preserve the pricing assumption used at the time. Do not
recalculate old rows with newer prices.

Retries are counted as separate ledger rows when they make separate billable or
potentially billable provider calls.

## OCR And Image Economics

OCR queue state and billable provider calls are separate. A queue row does not
necessarily equal one provider call. If one image causes an initial call plus two
billable retries, write three usage ledger rows.

The ledger schema supports OCR provider usage with `operation = 'image_ocr'`,
`provider = 'google'` or the repository's provider naming convention,
`service_model` set to the actual Gemini model, `image_count = 1` per provider
call, returned token counts when the provider response includes usage metadata,
duration, status, and request/correlation identifiers where available.

Do not infer token usage from image count. Do not store the image, base64 image
data, OCR raw/full text, provider API keys, authentication values, or unnecessary
PII in telemetry. Product/domain tables own extracted content.

Current release dependency: the live `extract-plate-text` Supabase Edge Function
is deployed in `gate-project-dev`, but its current source is not present under
`supabase/functions` in this repository branch. This PR therefore provides the
ledger/read-model foundation for OCR economics, but OCR provider instrumentation
remains not yet instrumented and must be completed only after the function source
and its unsafe internal authentication drift are repaired without duplicating or
preserving hardcoded credentials.

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
- Image/OCR usage is foundation-ready but not yet instrumented until the
  repository contains the live `extract-plate-text` source and that provider call
  writes one ledger row per actual Gemini invocation.
- Provider costs remain unavailable when pricing is not explicitly configured or
  returned by the provider.
- Critical flow health is conservative and will show Unknown until each flow has
  enough real telemetry.
