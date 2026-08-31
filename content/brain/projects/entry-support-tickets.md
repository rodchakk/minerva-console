# ENTRY — Native Support Tickets

Official Brain capture for `ENTRY-SUP-001`, the native support-ticket system spanning ENTRY Mobile, ENTRY Web, the ENTRY Supabase backend, and Minerva Console.

This document records product and architecture knowledge only. Brain does not connect to ENTRY operational data or become a runtime dependency of the ticket system.

## Status

- **Feature:** `ENTRY-SUP-001 — Native Support Tickets`
- **Status:** Completed, QA-validated, and merged.
- **Date closed:** 2026-08-31.
- **ENTRY Mobile:** `rodchakk/node-bridge-foundation` PR `#14`, merged to `main` as `283366a3ae9e782923e52445564c8ff4e60ec860`.
- **ENTRY Web:** `rodchakk/Entry-Web` PR `#1`, merged to `master` as `f6c3229bdea2e519d48bd13246bc2f9696857aca`.
- **Minerva Console:** `rodchakk/minerva-console` PR `#95`, merged to `master` as `97aedabe717fd025d00286242fd334f6310e28d7`.
- **Console production:** Vercel deployment for `97aedabe717fd025d00286242fd334f6310e28d7` reached `READY` and is aliased to `console.minervatechs.com`.
- **Mobile store release:** not performed by this closeout; merge to `main` does not publish a new App Store / Play Store version.

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

Minerva flow:

1. Open ENTRY → Tickets in Minerva Console.
2. Filter and inspect tickets.
3. View resident/community/device context.
4. Reply from the ticket workspace.
5. Update ticket status.
6. Receive new ticket/message changes without manual browser refresh through Supabase Realtime.

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

## ENTRY Mobile implementation

Canonical repository: `rodchakk/node-bridge-foundation`.

The resident support surface now:

- removes the previous hard-coded WhatsApp / `wa.me` support handoff;
- preserves the existing password-reset support section;
- supports ticket creation, history, detail, follow-up messages, and status display;
- sends limited technical context useful for support triage, including app/build/platform/OS/device and resident role/unit context;
- uses Supabase Realtime on the ticket detail screen so new Minerva replies and ticket-state changes appear without manual refresh.

### Keyboard QA fix

Physical Android QA identified that the on-screen keyboard covered the conversation/composer. Before merge, the detail screen was corrected so Android resizes the conversation area, keeps the composer usable, and scrolls toward the latest conversation content when the keyboard opens.

## Minerva Console implementation

Minerva Console now includes `Tickets` under ENTRY with:

- responsive ticket inbox;
- status filters;
- ticket detail workspace;
- conversation history;
- status controls;
- technical context;
- staff replies;
- Supabase Realtime-triggered server refreshes.

During physical QA, the first Console realtime implementation did not update when the resident sent a new message. The final fix subscribed Console directly to inserts on `support_ticket_messages` in addition to ticket inserts/updates. The corrected behavior was validated before merge.

## ENTRY Web implementation

ENTRY Web replaces its previous Support placeholder with:

- authenticated ticket creation;
- the signed-in user's ticket history;
- ticket detail/conversation view;
- follow-up replies;
- the same support backend/RLS contract used by mobile.

This closeout does not claim realtime behavior for the ENTRY Web resident surface; the realtime QA performed here specifically validated ENTRY Mobile ↔ Minerva Console.

## QA evidence

Owner physical-device QA was performed on Android using an Expo development build.

Validated end-to-end behavior:

- resident creates ticket;
- ticket appears in Minerva Console;
- resident sends follow-up message;
- Minerva sees the conversation;
- Minerva replies;
- mobile receives the reply automatically without refresh;
- Console receives resident messages automatically without refresh after the final realtime fix;
- staff reply transitions open → in review;
- Minerva can mark ticket resolved;
- resident sees resolved state;
- resident reply to resolved ticket reopens it;
- keyboard no longer obscures the mobile composer/conversation.

Minerva Console CI passed TypeScript, lint, build, and Brain guardrails before merge. Vercel preview validation also passed and the final production deployment reached `READY`.

### QA not claimed

- No physical iOS support-ticket QA was completed in this closeout.
- No new production mobile store build/release was performed.
- ENTRY Web resident realtime behavior was not part of the validated realtime loop.

## Deliberate MVP exclusions

The completed MVP intentionally does **not** include:

- attachments or screenshot uploads;
- push/email support alerts;
- SLA timers;
- priorities;
- assignment queues/departments;
- macros/tags;
- analytics;
- AI support agent behavior;
- live-chat presence/typing indicators.

These exclusions kept the first implementation small and operationally useful.

## Follow-up: push notifications

Push notifications are the clearest next support enhancement, but they are **not part of ENTRY-SUP-001**.

Current behavior:

- when ENTRY is open on the ticket conversation, Supabase Realtime can deliver new replies;
- when ENTRY is closed or backgrounded, the resident does not receive a dedicated support notification from this feature.

A future reviewed mission may connect staff replies to ENTRY's existing push infrastructure so a resident can receive a notification such as `Minerva respondió a tu solicitud ENT-000001` and deep-link into the ticket.

This should be treated as a separate mission because background push delivery, notification payloads, deep links, token ownership, duplicate-delivery protection, and platform QA have a different risk surface from Realtime.

## Release boundary

`ENTRY-SUP-001` is code-complete and merged, but mobile distribution remains a separate release operation.

Before claiming the feature is available in public store builds, verify the target ENTRY release includes merge commit `283366a3ae9e782923e52445564c8ff4e60ec860` (or a descendant), complete the intended release QA, and publish through the normal Play Store / App Store process.

## Final verdict

`ENTRY-SUP-001` is **COMPLETED AND MERGED**.

The support workflow is now first-party, ticket-based, conversational, status-aware, and realtime between the validated Android resident flow and Minerva Console. Remaining push notification work is explicitly deferred rather than silently included in this closure.
