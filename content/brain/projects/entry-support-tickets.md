# ENTRY — Native Support Tickets

Official Brain capture for `ENTRY-SUP-001`, the native support-ticket system spanning ENTRY Mobile, ENTRY Web, the ENTRY Supabase backend, Minerva Console, and the Minerva Field operational surface.

This document records product and architecture knowledge only. Brain does not connect to ENTRY operational data or become a runtime dependency of the ticket system.

## Status

- **Feature:** `ENTRY-SUP-001 — Native Support Tickets`
- **Status:** Completed, QA-validated, merged, and extended into Minerva Field.
- **Original closeout:** 2026-08-31.
- **Minerva Field support extension closeout:** 2026-09-03.
- **ENTRY Mobile:** `rodchakk/node-bridge-foundation` PR `#14`, merged to `main` as `283366a3ae9e782923e52445564c8ff4e60ec860`.
- **ENTRY Web:** `rodchakk/Entry-Web` PR `#1`, merged to `master` as `f6c3229bdea2e519d48bd13246bc2f9696857aca`.
- **Minerva Console original ticket workspace:** `rodchakk/minerva-console` PR `#95`, merged to `master` as `97aedabe717fd025d00286242fd334f6310e28d7`.
- **Minerva Field canonical ticket-chat hardening:** PR `#125`, merged to `master` as `65384c04fb722fbaf693618a0b0a156805556337` and deployed `READY` to `console.minervatechs.com`.

## Product purpose

ENTRY previously handed resident technical support off to WhatsApp. `ENTRY-SUP-001` replaces that handoff with a first-party support workflow that keeps the request, conversation, status, and technical context inside Minerva-controlled systems.

Resident flow:

1. Open `Soporte Técnico` inside ENTRY.
2. Choose a category and describe the problem.
3. Submit a ticket and receive an `ENT-xxxxxx` ticket number.
4. Review `Mis solicitudes`.
5. Open a ticket and continue the conversation with Minerva.
6. See ticket state as `Recibido`, `En revisión`, or `Resuelto`.
7. Reply to a resolved ticket to reopen it automatically.

Minerva flow now has two complementary admin surfaces:

1. **Minerva Console** for the fuller desktop ticket workspace.
2. **Minerva Field** for mobile/PWA support while away from a laptop, including chat-style replies and quick operational actions.

Both surfaces reuse the same ticket/message backend and authorization model.

## Backend implementation

ENTRY Supabase project: `gate-project-dev` (`ytzvislhvrcdtkbtpbmu`).

Applied and versioned migrations:

- `20260831173348_entry_support_tickets_mvp`
- `20260831180244_entry_support_tickets_perf_hardening`
- `20260831232627_entry_support_tickets_realtime`

Primary tables:

- `public.support_tickets`
- `public.support_ticket_messages`

Ticket numbers are sequence-backed and formatted as `ENT-000001`, `ENT-000002`, etc.

Statuses are intentionally small:

- `open`
- `in_progress`
- `resolved`

Primary RPCs:

- `support_create_ticket(...)`
- `support_add_message(...)`
- `support_update_status(...)`
- `support_admin_list_tickets(...)`
- `support_admin_get_ticket(...)`

Behavioral rules:

- a Minerva staff reply to an open ticket moves it to `in_progress`;
- a resident reply to a resolved ticket reopens it to `open`;
- resolving a ticket records `resolved_at`;
- owner visibility and superadmin visibility are enforced through RLS / backend authorization rather than UI-only checks.

## Security and authorization contract

- Authenticated residents can read only their own tickets and ticket messages.
- Minerva superadmins can read all support tickets and conversations.
- Direct authenticated table inserts/updates/deletes are not the supported write path; writes go through reviewed RPCs.
- Admin RPCs independently require superadmin authorization.
- Support-specific RLS performance findings discovered during implementation were hardened before merge.
- The ticket system does not expose service-role credentials to clients.
- Minerva Field does not create a parallel support database or bypass the support RPC/RLS contract.
- Brain must never ingest support conversations, customer identities, or ticket operational data.

## ENTRY Mobile implementation

Canonical repository: `rodchakk/node-bridge-foundation`.

The resident support surface now:

- removes the previous hard-coded WhatsApp / `wa.me` support handoff;
- preserves the existing password-reset support section;
- supports ticket creation, history, detail, follow-up messages, and status display;
- sends limited technical context useful for support triage, including app/build/platform/OS/device and resident role/unit context;
- uses Supabase Realtime on the ticket detail screen so new Minerva replies and ticket-state changes appear without manual refresh.

### Keyboard QA fix

Physical Android QA identified that the on-screen keyboard covered the conversation/composer. Before the original support closeout, the resident detail screen was corrected so Android resizes the conversation area, keeps the composer usable, and scrolls toward the latest conversation content when the keyboard opens.

## Minerva Console implementation

Minerva Console includes `Tickets` under ENTRY with:

- responsive ticket inbox;
- status filters;
- ticket detail workspace;
- conversation history;
- status controls;
- technical context;
- staff replies;
- Supabase Realtime-triggered updates.

During physical QA, the first Console realtime implementation did not update when the resident sent a new message. The corrected desktop behavior subscribed directly to inserts on `support_ticket_messages` in addition to ticket inserts/updates.

## Minerva Field extension — 2026-09-03

The existing support system was extended into the installed Minerva Field PWA without creating a second chat implementation or new support persistence.

### Field ticket workspace

- `Tickets` is a first-class ENTRY Field destination.
- Inbox filters existing ticket states.
- Ticket detail presents the support thread as a mobile conversation.
- Resident/requester messages are left-aligned; Minerva replies are right-aligned.
- Existing ticket metadata can be inspected without creating a separate Field support profile.
- Current Quick Actions reuse existing ENTRY operations:
  - reset access;
  - open the requester in Field People;
  - start, resolve, or reopen the ticket.

### PWA realtime and keyboard closeout

PR `#122` introduced the Field ticket chat. Physical PWA QA then exposed two defects: Field did not reliably receive new messages without refresh, and the software keyboard could push the composer outside the visible viewport or move the operator away from the message being answered.

PR `#124` attempted the first repair but remained incomplete in production QA. It is superseded by PR `#125`.

PR `#125` is the canonical Field implementation:

- Supabase Realtime remains the primary delivery mechanism.
- Field explicitly authenticates Realtime with the current session.
- Incoming message inserts are applied directly to client chat state rather than relying only on a Next.js server refresh.
- A 2-second database reconciliation runs only while the ticket tab is visible to recover if the Android/PWA runtime drops a Realtime event; it pauses when hidden and adds no worker, cron, table, or new backend service.
- The chat measures the real remaining viewport above Field navigation.
- When the reply input opens the software keyboard, Field navigation and Quick Actions are temporarily hidden.
- The composer remains above the keyboard.
- The conversation preserves the operator's current reading position when the keyboard opens.
- If the operator is reading older messages, new arrivals expose a `New message` jump control instead of forcibly moving the conversation.

The `#125` production deployment reached `READY` on `console.minervatechs.com`.

## ENTRY Web implementation

ENTRY Web replaces its previous Support placeholder with:

- authenticated ticket creation;
- the signed-in user's ticket history;
- ticket detail/conversation view;
- follow-up replies;
- the same support backend/RLS contract used by mobile.

The original support closeout did not claim realtime behavior for the ENTRY Web resident surface; realtime QA specifically validated the resident/mobile and Minerva admin workflows described above.

## QA evidence

Original owner physical-device QA was performed on Android using an Expo development build. Later Field QA was performed from the installed mobile PWA and directly informed the `#124` → `#125` hardening cycle.

Validated support behavior across the completed work includes:

- resident creates ticket;
- Minerva can inspect the ticket;
- resident and Minerva can exchange follow-up messages;
- staff reply transitions open → in review;
- Minerva can mark ticket resolved;
- resident reply to resolved ticket reopens it;
- mobile resident flow uses Realtime for replies/status;
- Minerva Field uses authenticated Realtime plus visible-only reconciliation for mobile/PWA reliability;
- Field ticket composer remains usable with the software keyboard open;
- Field preserves the message-reading context when entering composer mode.

Minerva Console CI for the final Field hardening passed Build, TypeScript, full lint, Brain/layout lint, and Brain guardrails before merge.

## Deliberate MVP exclusions

The support foundation intentionally does **not** require:

- push/email support alerts;
- SLA timers;
- priorities;
- assignment queues/departments;
- analytics;
- AI support agent behavior;
- live-chat presence/typing indicators.

Attachments and canned-response tooling were also excluded from the original MVP and are not implied as complete by the Field extension.

## Future backlog — Field Quick Responses

**Captured 2026-09-03; not approved for implementation yet.**

A future Minerva Field support enhancement should provide operator-triggered **Quick Responses** for recurring support cases. Initial candidates:

- instructions for enabling ENTRY notifications;
- instructions for enabling geolocation/location permissions;
- instructional images/screenshots that show the resident how to complete those setup steps.

The library should grow gradually as recurring real-world support needs become clear.

Implementation constraints when this is eventually prioritized:

- reuse `support_tickets` / `support_ticket_messages` and the existing message flow;
- do not create a separate chat backend;
- keep the operator in control of what is sent;
- validate notification/geolocation instructions against the then-current iOS and Android ENTRY UX;
- manage generic instructional images as product support assets, never as Brain copies of customer conversations or PII;
- do not introduce an AI service merely to provide canned responses.

## Follow-up: push notifications

Push notifications remain a separate support enhancement.

Current behavior:

- while the relevant support surface is open, Realtime can deliver conversation updates;
- when ENTRY is closed or backgrounded, the resident does not receive a dedicated support push from this feature.

A future reviewed mission may connect staff replies to ENTRY's existing push infrastructure so a resident can receive a notification such as `Minerva respondió a tu solicitud ENT-000001` and deep-link into the ticket.

This remains separate because background push delivery, notification payloads, deep links, token ownership, duplicate-delivery protection, and platform QA have a different risk surface from Realtime.

## Final verdict

`ENTRY-SUP-001` is **COMPLETED AND MERGED**, and its existing backend now powers both the desktop Minerva Console support workspace and the mobile Minerva Field support workspace.

The September 3 Field pass is closed for now. PR `#125` is canonical for Field live-chat/composer behavior. Quick Responses—starting with notifications, geolocation, and instructional images—are captured as future backlog rather than silently included in the completed scope.
