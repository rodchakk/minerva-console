# ENTRY — Native Support Tickets

Official Brain capture for `ENTRY-SUP-001`, the native support-ticket system spanning ENTRY Mobile, ENTRY Web, the ENTRY Supabase backend, and Minerva Console.

This document records product and architecture knowledge only. Brain does not connect to ENTRY operational data or become a runtime dependency of the ticket system.

## Status

- **Feature:** `ENTRY-SUP-001 — Native Support Tickets`
- **Feature status:** Completed, QA-validated, merged, and security-hardened.
- **Feature closeout date:** 2026-08-31.
- **Release status updated:** 2026-09-01.
- **ENTRY Mobile MVP:** `rodchakk/node-bridge-foundation` PR `#14`, merged to `main` as `283366a3ae9e782923e52445564c8ff4e60ec860`.
- **ENTRY Mobile support UI polish:** PR `#15`, merged to `main` as `295d46a4d0737b364aab236b7ebe041c15504541`.
- **ENTRY Web:** `rodchakk/Entry-Web` PR `#1`, merged to `master` as `f6c3229bdea2e519d48bd13246bc2f9696857aca`.
- **Minerva Console MVP:** `rodchakk/minerva-console` PR `#95`, merged to `master` as `97aedabe717fd025d00286242fd334f6310e28d7`.
- **Minerva Console support workspace polish / Quick Tools:** PR `#97`, merged as `10836744dae0272bf3fddc587c8b38b8e9d37a67`.
- **Support security hardening:** PR `#98`, merged as `4ea893112dc0ebcf74767128c166cbab68716137`; production migration applied and verified.
- **Migration-history sync:** PR `#99`, merged as `8cbaa82da081374cf311f3f5884f8f518ac3ad52`.
- **Mobile release prep:** `rodchakk/node-bridge-foundation` PR `#16`, merged as `2c2df22098002bf16da34343a0628945b5d10bd8`; app version `1.0.2` and EAS `production` channel configured.
- **Console production:** current Support workspace changes were deployed through the normal Vercel production path and reached `READY` during the implementation/hardening passes.
- **Public mobile distribution:** in progress; do not yet claim ENTRY `1.0.2` as publicly distributed on both stores.

### Store release checkpoint — 2026-09-01

- **Android:** production EAS build finished successfully as ENTRY `1.0.2`, `versionCode 12`, build ID `69a74390-a7d8-4021-bb81-15c643535575`.
- **Android Internal Testing:** `1.0.2` is active and available to internal testers in Google Play.
- **Android Production:** the `1.0.2` full-rollout production change has been staged in Google Play Publishing overview. At the last verified checkpoint it was still listed under **Changes not yet submitted for review**; final review submission / rollout confirmation was not yet captured in Brain evidence.
- **iOS:** production EAS build finished successfully as ENTRY `1.0.2`, build `11`, build ID `d2f6937d-e8b3-49ec-b09c-7d2c96b201b7`.
- **iOS 1.0.1:** released and now `Ready for Distribution`, which unlocked creation of the next App Store version.
- **iOS 1.0.2 (11):** submitted to Apple App Review and currently `Waiting for Review`.
- **TestFlight:** no final TestFlight QA was performed for this release path; release submission proceeded after the owner reported completed testing looked correct.
- **Apple metadata follow-up:** App Store Connect shows new Age Ratings / Social Media questions due by 2026-09-07. They did not block submission of `1.0.2`, but remain an account-maintenance follow-up.

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
- `20260901042453_entry_support_security_hardening`

The first three migrations originated in the ENTRY Mobile repository and were later restored verbatim into Minerva Console source control so the Support database layer is auditable from the Console repository as well. The hardening migration filename in source control was synchronized to the exact migration version recorded by production.

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

A defensive security review and direct production-schema verification were completed after the MVP closeout.

Verified production posture after `20260901042453_entry_support_security_hardening`:

- RLS remains enabled on `support_tickets` and `support_ticket_messages`.
- Authenticated residents can select only their own tickets/messages through owner-or-superadmin policies.
- Minerva superadmins can read all support tickets and conversations through the same policies / reviewed admin RPC boundary.
- `authenticated` has direct `SELECT` only on the two Support tables; direct table writes, `TRUNCATE`, `TRIGGER`, and `REFERENCES` privileges were removed from browser roles.
- `anon` has no direct Support table access.
- Browser roles have no privileges on `support_ticket_number_seq`; ticket numbering continues through the reviewed SECURITY DEFINER create-ticket RPC.
- The five Support RPCs expose `EXECUTE` to `authenticated` and not to `anon`.
- Both Support tables remain in `supabase_realtime`.
- Support writes continue through reviewed RPCs rather than direct client table writes.
- Admin RPCs independently require superadmin authorization.
- No password-reset behavior, RLS policy logic, Realtime subscription behavior, or Support workflow semantics were changed by the hardening migration.
- Raw Supabase/Postgres load errors are logged server-side in Console while user-facing Support errors are generic.
- The ticket system does not expose service-role credentials to clients.

The security hardening deliberately did **not** expand scope into resident rate limiting, metadata-size limits, or recovery-code audit infrastructure. Those remain separate defense-in-depth candidates rather than release blockers.

## ENTRY Mobile implementation

Canonical repository: `rodchakk/node-bridge-foundation`.

The resident support surface now:

- removes the previous hard-coded WhatsApp / `wa.me` support handoff;
- preserves the existing password-reset support section;
- supports ticket creation, history, detail, follow-up messages, and status display;
- sends limited technical context useful for support triage, including app/build/platform/OS/device and resident role/unit context;
- uses Supabase Realtime on the ticket detail screen so new Minerva replies and ticket-state changes appear without manual refresh.

### Mobile support UI polish

PR `#15` refined the resident Support landing screen without adding native dependencies or changing the backend contract:

- `Reportar un problema` is the primary action;
- category starts unselected and is chosen through a compact bottom sheet;
- submit remains disabled until category and valid description are present;
- password reset is a compact expandable row rather than a competing full section;
- `Mis solicitudes` initially shows at most two tickets with `Ver todas` / `Ver menos` when needed;
- ticket cards remain directly tappable.

### Keyboard QA fix

Physical Android QA identified that the on-screen keyboard covered the conversation/composer. Before merge, the detail screen was corrected so Android resizes the conversation area, keeps the composer usable, and scrolls toward the latest conversation content when the keyboard opens.

## Minerva Console implementation

Minerva Console includes `Tickets` under ENTRY with:

- responsive ticket inbox;
- status filters;
- ticket detail workspace;
- conversation history;
- status controls;
- technical context;
- staff replies;
- Supabase Realtime-triggered server refreshes.

During physical QA, the first Console realtime implementation did not update when the resident sent a new message. The final fix subscribed Console directly to inserts on `support_ticket_messages` in addition to ticket inserts/updates. The corrected behavior was validated before merge.

### Console support workspace polish

PR `#97` converted the detail screen into a denser operational support workspace while preserving backend behavior:

- fixed-height chat-style conversation area with internal scrolling and anchored composer;
- English system/chrome labels on the detailed Console surface while user/source data remains as authored;
- right rail with `Quick Tools`, `Context`, and `Technical Context`;
- approved Quick Tools v1: Reset password, View resident, View community, Copy diagnostics;
- reset-password action derives the target user/community server-side from authoritative ticket data and reuses the canonical reset flow;
- reset requires explicit confirmation and can return the existing email-success or recovery-code fallback result;
- no destructive Quick Tools were added.

The older Support ticket-list surface may still contain Spanish system labels; that language cleanup was intentionally not mixed into the workspace PR.

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
- keyboard no longer obscures the mobile composer/conversation;
- polished Android Support landing flow was physically rechecked and accepted.

Minerva Console CI passed TypeScript, lint, build, and Brain guardrails on the relevant Support implementation/security PRs. Vercel checks passed on the reviewed Console Support changes.

### QA / distribution boundaries not claimed

- No final TestFlight-based iOS Support QA was completed for ENTRY `1.0.2`.
- ENTRY Web resident realtime behavior was not part of the validated realtime loop.
- Android `1.0.2` should not be called publicly released until Google Play production review/rollout is confirmed.
- iOS `1.0.2 (11)` should not be called publicly released while App Store Connect remains `Waiting for Review`.

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

`ENTRY-SUP-001` is code-complete, merged, production-security-hardened, and included in the ENTRY `1.0.2` production binaries.

Release operations are still in progress at this checkpoint:

- Android `1.0.2` / `versionCode 12` exists in Internal Testing and has a Production full-rollout change staged, but final production submission/approval is not yet recorded here.
- iOS `1.0.2` / build `11` is `Waiting for Review` in App Store Connect.

Only update this Brain record to **publicly distributed** after each store independently confirms the production release.

## Final verdict

`ENTRY-SUP-001` is **COMPLETED, MERGED, AND SECURITY-HARDENED**.

The support workflow is first-party, ticket-based, conversational, status-aware, and Realtime-enabled across the validated Android resident ↔ Minerva Console flow. ENTRY `1.0.2` release binaries contain the completed Support work; store distribution is the only remaining release-state checkpoint. Push notification work remains explicitly deferred as a separate future mission.
