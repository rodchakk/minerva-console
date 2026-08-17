# ENTRY Community Registration - Campaign Launch UI

**Mission:** `ENTRY-ONB-007`

**Status:** CLOSED — PR #39 merged to `master`; production web deployment verified.

## Scope

`ENTRY-ONB-007` adds the first internal Minerva Console UI for launching a
Community Registration campaign from a specific community detail page.

The UI belongs on:

- `app/(console)/products/entry/communities/[communityId]/page.tsx`

It does not belong on:

- the global communities list;
- Community Users;
- the original Create Community wizard.

## Backend Boundary

Initial PR review found that a two-network-RPC launch could strand a community
if campaign creation succeeded but unit attachment failed. The hardened slice
adds one forward-only migration:

- `supabase/migrations/20260817014957_create_entry_community_registration_launch_ui_hardening_v1.sql`

The migration adds two service-role-only RPCs:

- `launch_community_registration_campaign_v1(uuid, uuid[], text, text, text, text, integer, timestamptz, timestamptz, text, jsonb, uuid)`
- `rotate_community_registration_campaign_access_v1(uuid, text, uuid)`

`launch_community_registration_campaign_v1(...)` composes the previously
approved `create_community_registration_campaign_v1(...)` and
`add_community_registration_units_v1(...)` inside one PostgreSQL function call.
If unit validation or attachment fails, the exception is not caught, so the
campaign row and campaign access hash roll back with the unit work.

`rotate_community_registration_campaign_access_v1(...)` locks the campaign,
revokes active `campaign_access` tokens, inserts one replacement active hash,
verifies exactly one active campaign access token remains, and returns only
safe metadata.

The admin actions still verify the Console operator with `requireSuperadmin()`,
then call these RPCs through the service-role client and pass the authenticated
operator ID as actor metadata.

## Token Lifecycle

The plaintext campaign capability is generated server-side with secure random
bytes and immediately hashed with the approved campaign-token hashing helper.

Only the hash is sent to `launch_community_registration_campaign_v1(...)`.

The plaintext capability is returned to the authenticated operator only in the
immediate Server Action success response so the launch modal can render:

`/entry/register/<slug>/access?token=<capability>`

The plaintext token is not stored in Supabase, localStorage, sessionStorage,
Brain, diagnostics or logs.

After reload, the same plaintext link cannot be redisplayed because the
database intentionally stores token hashes only. If the response is lost or the
operator failed to copy the link, the Community Detail card offers `Replace
registration link`, which generates a new plaintext capability server-side,
hashes it, calls the replacement RPC, invalidates previous campaign-access
links, and shows the new plaintext link only in the immediate success state.

## Campaign Progress

The admin card counts a unit as submitted when its
`community_registration_units.status` is one of:

- `submitted`
- `edit_enabled`
- `needs_correction`
- `reviewed`
- `confirmed`
- `processed`

`unregistered` does not count as submitted.

## Transaction Boundary

Campaign creation, campaign access hash insertion, and selected unit attachment
now happen inside one database RPC invocation. A launch either commits with the
selected units attached or rolls back without creating an operational campaign.

The registration link is not exposed unless the atomic launch RPC succeeds.
Replacement link generation is also a single database RPC invocation: old
active campaign access is revoked and the replacement active hash is inserted
together, or the previous active link remains valid after rollback.

## Explicit Non-Scope

This mission does not build:

- review UI;
- patronato confirmation UI;
- conversion management UI;
- ENTRY mobile changes;
- Vercel/env/Upstash changes.

## Validation

Focused validators:

- `scripts/entry-onb-007-validate-campaign-launch-ui.mjs`
- `scripts/entry-onb-007-validate-launch-hardening.mjs`

The hardening validator maps the review cases A-G to static assertions for
atomic launch, rollback behavior, lost-response replacement, replacement
rollback, service-role boundaries, and delegated cross-community unit
validation.

SQL engine validation passed against Supabase project `gate-project-dev`
(`ytzvislhvrcdtkbtpbmu`) on PostgreSQL 17. Validation was first performed
transactionally and rolled back cleanly. The engine tests covered successful
atomic launch; complete campaign, unit, and single active `campaign_access`
state; cross-community unit failure rollback; successful campaign-access
replacement; old-link invalidation; replacement-token public resolve; failed
replacement rollback preserving previous active access; non-open campaign
replacement rejection with `P0409`; authenticated caller rejection with
`42501`; service-role-only execution grants; and
`campaign_access_replaced` event/constraint compatibility.

After transactional validation passed, the exact approved migration was
permanently applied to `gate-project-dev` only. Supabase recorded migration
version `20260817014957`. Post-DDL verification confirmed both RPCs exist with
the intended grants. No test campaigns from the SQL engine tests remained.
Supabase security/performance advisors were reviewed; existing project-level
advisor debt remains, but no new ONB-007-specific blocker was identified.

At the SQL-engine validation stage, Production/seshat, ENTRY mobile, Vercel
environment configuration, Upstash, rate limits, and secrets were not changed.

## Runtime Walkthrough

Manual runtime walkthrough passed on the PR #39 Vercel Preview deployment for
commit `c68043a`, connected to Supabase project `gate-project-dev`
(`ytzvislhvrcdtkbtpbmu`).

The walkthrough used test community `Residencial Prueba CR`. The Community
Detail page rendered the Resident registration card in the no-active-campaign
state with `0 / 5 units submitted` and `5 participating units`. The launch
modal rendered with default title `Registro de residentes - Residencial Prueba
CR`, resident limit `3`, and Casa 1 through Casa 5 selected.

Real campaign launch succeeded. Database verification showed `status = open`,
five participating units, default resident limit `3`, and exactly one active
`campaign_access` token. The plaintext registration URL was shown only in the
immediate success state.

After reload, the plaintext URL was not redisplayed. Campaign status and
progress remained visible, and `Replace registration link` was available
because the campaign was open.

The first Preview public-access attempt returned `503` with runtime log
`entry_cr_rate_limit_failure=missing_runtime_configuration`. Root cause was
Preview runtime variables scoped to the obsolete
`codex/entry-onb-006-public-registration-foundation` branch. The operational
correction broadened the existing Preview variable branch scope to all Preview
branches only; values and secrets were not changed, Production variables were
not changed, and the same PR commit was redeployed. After redeploy, `/access`
returned `303` and the public campaign page returned `200`.

Registration-link replacement succeeded for the open campaign. Verification
showed exactly one active `campaign_access`, exactly one previous
`campaign_access` revoked, exactly one `campaign_access_replaced` audit event,
and the campaign still open. The new capability reached public registration;
the revoked capability resolved to `Enlace no disponible`.

Public unit lookup through the replacement capability succeeded for Casa 1.
The resident form rendered and displayed `Puedes registrar hasta 3 residentes.`

Before submission testing, Casa 1 through Casa 5 were confirmed
`unregistered` with `submission_count = 0` and `resident_count = 0`. The
operator then completed an end-to-end public submission through the newly
generated registration capability. Casa 1 transitioned to `submitted` with
`submission_count = 1` and `resident_count = 2`; Casa 2 through Casa 5 remained
`unregistered` with zero submissions and zero residents. The Console card then
refreshed from `0 / 5` to `1 / 5` submitted units. This confirms the ONB-007
campaign launch and link-generation path interoperates with the existing public
registration submission flow and its internal progress query.

Production/seshat was not touched during the Preview walkthrough. ENTRY mobile
was not touched. No production migration was applied. No Upstash credential
value was changed or rotated. `ENTRY_CR_RATE_LIMIT_SECRET` was not changed or
rotated. No rate-limit policy or code was changed.

## Post-Merge Closeout

PR #39 was squash-merged to `master` as:

`f3c95a784f5356427fba1797ea851a095897b88d`

Vercel deployed that exact commit to the Minerva Console Production target.
Post-deploy verification confirmed `READY`, `console.minervatechs.com` serving
the merged build, and no new Vercel runtime errors in the smoke window.

Production Minerva Console wiring was verified against Supabase project
`gate-project-dev` (`ytzvislhvrcdtkbtpbmu`). That project already contains the
complete Community Registration migration chain through
`20260817014957_create_entry_community_registration_launch_ui_hardening_v1`.
No additional ONB-007 database migration was required after merge.

Supabase project `seshat` (`vfvbvywvmoevyucqgtos`) is separate from the ENTRY
Community Registration backend and does not contain the `communities` or
`community_registration_*` tables. It was not modified.

The dedicated test community retains the runtime walkthrough state: Casa 1 is
`submitted` with one submission and two resident records; Casa 2 through Casa 5
remain `unregistered`.

Existing Supabase advisor debt, Brain guardrail debt, and unrelated full-lint
debt remain separate follow-up work and were not changed by this closeout.

## Follow-Up Findings

FOLLOW-UP 1:
Newly created/incomplete community may surface as Needs attention instead of
Pending setup.

FOLLOW-UP 2:
Assign resident admin may be offered when zero eligible residents/users exist.

No fix was made for these findings in `ENTRY-ONB-007`.
