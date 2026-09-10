# ENTRY Web Push notifications

Status: **code ready for production review; release infrastructure intentionally not enabled yet**.

This feature sends minimal browser Web Push alerts to currently authorized Minerva operators when an ENTRY support ticket is created or when the ENTRY user adds a new message to a ticket. Staff-authored replies do not create an incoming-message alert.

## Architecture

```text
support_tickets / support_ticket_messages
              ↓ database trigger
entry_web_push_events (durable event queue)
              ↓ fan-out
entry_web_push_deliveries (per device)
              ↓
pg_cron (1 minute) → pg_net
              ↓ Bearer secret
POST /api/entry/push/dispatch (Node / Vercel)
              ↓ web-push + VAPID
browser PushSubscription
              ↓
/minerva-entry-push-sw.js
              ↓
authorized Console or Field ticket route
```

The Supabase scheduler only wakes the Node dispatcher. There is deliberately **no second Web Push delivery implementation in a Supabase Edge Function**.

## Browser opt-in

Console and Minerva Field expose an `Enable alerts` control on their ENTRY Tickets pages. Permission is requested only from that explicit user gesture.

The browser registers the single root service worker `/minerva-entry-push-sw.js`, obtains or creates a `PushSubscription`, then posts the subscription to the authenticated API. The API derives `user.id` from the server session; client-provided identity, role, tenant, or community values are never trusted.

An existing browser subscription is synchronized again when the control loads. The database serializes endpoint ownership and allows only one active owner for a browser endpoint, which prevents a shared browser from keeping the same endpoint active for two Minerva accounts after an account change.

`Disable alerts` attempts both server-side deactivation and `PushSubscription.unsubscribe()`. The two paths are independent so one failure does not skip the other.

## Sign-out safety

Console and Field perform best-effort Push cleanup before sign-out. The browser cleanup is bounded and the server action also attempts to deactivate the current endpoint while the authenticated user is still available.

Push cleanup is **fail-open to authentication logout**: network failure, browser Push failure, missing Push configuration, or Supabase cleanup failure must never prevent the user from signing out.

## Authorization model

All subscription, event, and delivery tables have RLS enabled and no `public`, `anon`, or `authenticated` table access. Runtime writes use the existing server-side service role.

Authorization is checked at multiple points:

1. Subscription API requires a currently authenticated superadmin and stores only the server-session user ID.
2. Subscription upsert checks `is_superadmin(user_id)` in the database.
3. Queue fan-out deactivates subscriptions whose user no longer passes `is_superadmin`.
4. Delivery claim checks authorization again.
5. Node re-checks the subscription's current `is_superadmin` status immediately before contacting the Web Push provider. A revoked subscription is pruned rather than sent.
6. Clicking a notification only navigates to an existing protected Console/Field ticket route. The service worker does not bypass route authorization.

## Queue semantics

Events are idempotent by `(source_table, source_id, event_type)`. Device deliveries are idempotent by `(event_id, subscription_id)`.

Claims use `FOR UPDATE SKIP LOCKED` so concurrent dispatcher calls do not send the same pending delivery concurrently. Processing claims older than 15 minutes are recovered. Delivery attempts are capped at 8.

Provider behavior:

- `2xx`: delivery recorded as sent.
- `404` / `410`: stale subscription pruned and deactivated.
- `429` / `5xx` / transport failure: bounded exponential retry, up to the 8-attempt limit.
- Other permanent provider failures: terminal failed delivery.

Parent event state is finalized from its device deliveries as `sent`, `failed`, or `skipped`.

## Privacy

The lock-screen payload contains only:

- ticket number;
- generic action text (`New support ticket received` or `New reply received on a support ticket`);
- a same-origin ticket route;
- a non-sensitive notification tag.

It does **not** include resident email, phone, full message body, ticket description, credentials, PushSubscription endpoint, encryption keys, VAPID private key, or dispatcher secret.

The service worker rejects arbitrary URLs. It only accepts canonical UUID routes matching:

- `/products/entry/tickets/<uuid>`
- `/field/entry/tickets/<uuid>`

Cross-origin URLs, query strings, hashes, and non-ticket paths are rejected.

## Required Vercel environment variables

Names only; values must never be committed:

- `ENTRY_WEB_PUSH_VAPID_SUBJECT`
- `ENTRY_WEB_PUSH_VAPID_PUBLIC_KEY`
- `ENTRY_WEB_PUSH_VAPID_PRIVATE_KEY`
- `ENTRY_WEB_PUSH_DISPATCH_SECRET`

The application also continues using its existing Supabase server configuration:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Required Supabase Vault secrets

Names only:

- `entry_web_push_dispatch_url`
- `entry_web_push_dispatch_secret`

`entry_web_push_dispatch_url` must be the production HTTPS URL ending in `/api/entry/push/dispatch`.

`entry_web_push_dispatch_secret` must exactly match the Vercel `ENTRY_WEB_PUSH_DISPATCH_SECRET` value.

No scheduler secret is embedded in migration SQL.

## Scheduler

Migration `20260910020000_entry_ticket_push_notifications.sql` defines, but intentionally does not invoke, the release helpers:

- `invoke_entry_web_push_dispatch_v1()` — reads Vault at runtime and invokes the protected Node route through `pg_net`.
- `install_entry_web_push_dispatch_schedule_v1()` — installs/replaces named job `entry-web-push-dispatch` at one-minute cadence only after both Vault secrets exist.
- `remove_entry_web_push_dispatch_schedule_v1()` — safe scheduler rollback helper.

This ordering prevents a merged migration from immediately calling an endpoint before production secrets are ready.

## Observability

Durable evidence is available in:

- `entry_web_push_events`
- `entry_web_push_deliveries`
- active/deactivated subscription state in `entry_web_push_subscriptions`
- bounded dispatch-cycle events in `system_event_log` under module `entry_web_push`

Dispatch-cycle logging contains counts/status only; subscription endpoints, encryption keys, payload contents, and secrets are not written to `system_event_log`.

Full normalization of these new Web Push rows into the existing `/products/entry/observability/notifications` drill-down is an immediate post-release observability enhancement if needed. The durable queue/delivery evidence already exists, so this does not block safe delivery activation.

## Release sequence

Do not skip or reorder the safety gates:

1. Merge the reviewed PR only after explicit `MERGE APPROVED`.
2. Apply migration `20260910020000_entry_ticket_push_notifications.sql` to the intended Supabase project.
3. Configure the four Vercel environment variables and allow the production app to redeploy.
4. Create the two Supabase Vault secrets with the production dispatcher URL and the matching dispatcher secret.
5. Invoke `install_entry_web_push_dispatch_schedule_v1()` once with an authorized service-role/admin release path.
6. Confirm the named cron job exists and the dispatcher cycles without errors.
7. Run the manual E2E checklist below before declaring the feature live.

## Manual production E2E checklist

- Console: enable alerts from an HTTPS browser and confirm subscription.
- Field: enable alerts from an HTTPS browser and confirm subscription.
- iOS/iPadOS: add Minerva Field to Home Screen and enable notifications from the installed PWA.
- Create a new support ticket and receive exactly the intended alert on opted-in devices.
- Add a resident/user reply and receive an incoming-message alert.
- Add a staff reply and verify it does **not** create the incoming-message alert.
- Validate two different subscribed devices for the same authorized operator.
- Deny notification permission and verify the UI fails safely.
- Disable alerts and verify both browser unsubscribe and server-side deactivation behavior.
- Exercise a stale `410` subscription and verify pruning/deactivation.
- Trigger concurrent dispatcher requests and verify no duplicate device delivery from queue races.
- Sign out with Push/network cleanup success and failure conditions; logout must always complete.
- Switch accounts on the same browser and verify one Push endpoint is never active for both operators.
- Revoke an operator's superadmin access and verify pending/new Web Push deliveries are pruned before provider send.
- Click an alert while signed out or unauthorized and verify the protected ticket route enforces normal auth.
- Call subscription/public-key APIs without authorization and verify denial.
- Call dispatch without the correct Bearer secret and verify `401`.

## Rollback

If Web Push must be stopped without affecting tickets:

1. Invoke `remove_entry_web_push_dispatch_schedule_v1()` to stop automatic dispatch.
2. Leave ticket creation/replies operational; queued Web Push rows are durable and isolated from support-ticket behavior.
3. If required, deactivate active Web Push subscriptions server-side.
4. Rotate/remove the dispatcher and VAPID production values after the scheduler is stopped.

Do not weaken npm TLS verification to work around a local CA error. The committed lockfile must install through normal `npm ci` in GitHub Actions/Vercel.
