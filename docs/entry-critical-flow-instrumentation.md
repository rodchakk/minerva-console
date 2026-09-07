# ENTRY Critical Flow Instrumentation

ENTRY-OBS-002 connects existing runtime truth sources to the Critical Flows already shown in Minerva Console Observability.

## Sources

- **Create pass** — `visit_passes` `AFTER INSERT` emits `PASS_CREATED`.
- **Validate QR** — persisted `security_event_log.RESOLVE_ACCESS_CREDENTIAL` rows with `metadata.method = QR` emit `QR_VALIDATED`.
- **Resident login** — a real Supabase Auth `auth.users.last_sign_in_at` change emits `RESIDENT_LOGIN` only when the user has an active unit assignment and an active RESIDENT/ADMIN membership.
- **Notifications** — terminal `community_message_push_queue.status` transitions to `sent` or `failed` emit `NOTIFICATION_SENT` / `NOTIFICATION_FAILED`.
- **Registration** — continues to use `community_registration_events` directly.
- **Image OCR** — continues to use `plate_ocr_queue` plus provider usage in `entry_usage_ledger`.

## Health semantics

Observability measures whether an ENTRY subsystem executed correctly, not whether every business input was accepted.

A malformed, expired, unknown, or unauthorized QR can be correctly rejected by the access resolver. That is a successful execution of the QR validation subsystem, so the telemetry event uses `status = success` with `result = rejected` and an optional sanitized reason. Normal security/business rejection must not turn QR health Degraded or Down.

A push queue row can also terminate as `failed` because the target audience has no active push tokens. That means there was nothing deliverable, not that Expo/provider infrastructure failed. This known condition is emitted as `status = skipped` with the generic code `PUSH_NO_ACTIVE_TOKENS`; raw queue error text is not copied into telemetry. Other terminal push failures remain operational failures.

True runtime/provider failures can still be emitted as failed operational events by their owning boundary. No-traffic windows remain `Unknown`; ENTRY does not manufacture heartbeats to make the dashboard green.

## Safety

Every trigger is fail-open for product operation. An observability write failure must not block pass creation, QR resolution, resident sign-in, or notification queue state changes.

Telemetry is allowlisted and does not copy pass PINs, QR tokens, email addresses, push title/body, provider responses, images, raw queue errors, or other user content. Community, actor/entity IDs, event type, outcome, short operational metadata, and correlation IDs are sufficient for this layer.

## Validation

Before release the migration is executed inside an explicit transaction with rollback and synthetic semantic checks for all four emitters. This validates the live database schema and trigger behavior without leaving schema changes, fake passes, fake auth activity, queue mutations, or telemetry behind.

After merge, apply the migration and verify future real traffic populates the corresponding Critical Flow cards. Quiet flows are expected to remain `Unknown` until they receive real traffic.
