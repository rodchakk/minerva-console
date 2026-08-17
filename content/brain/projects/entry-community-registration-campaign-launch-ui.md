# ENTRY Community Registration - Campaign Launch UI

**Mission:** `ENTRY-ONB-007`

**Status:** implementation PR prepared; hardening code review and dev SQL
engine validation passed; do not merge until review.

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

Production/seshat was not touched. ENTRY mobile was not touched. Vercel env,
Upstash, rate limits, and secrets were not changed.

## Follow-Up Findings

FOLLOW-UP 1:
Newly created/incomplete community may surface as Needs attention instead of
Pending setup.

FOLLOW-UP 2:
Assign resident admin may be offered when zero eligible residents/users exist.

No fix was made for these findings in `ENTRY-ONB-007`.
