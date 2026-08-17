# ENTRY Community Registration - Campaign Launch UI

**Mission:** `ENTRY-ONB-007`

**Status:** implementation PR prepared; do not merge until review.

## Scope

`ENTRY-ONB-007` adds the first internal Minerva Console UI for launching a
Community Registration campaign from a specific community detail page.

The UI belongs on:

- `app/(console)/products/entry/communities/[communityId]/page.tsx`

It does not belong on:

- the global communities list;
- Community Users;
- the original Create Community wizard.

## Backend Reuse

The existing backend capabilities are sufficient for this slice:

- `create_community_registration_campaign_v1(...)`
- `add_community_registration_units_v1(...)`

No schema migration is required.

The RPCs are service-role only. The admin action first verifies the Console
operator with `requireSuperadmin()`, then calls the existing RPCs through the
service-role client and passes the authenticated operator ID as actor metadata.

## Token Lifecycle

The plaintext campaign capability is generated server-side with secure random
bytes and immediately hashed with the approved campaign-token hashing helper.

Only the hash is sent to `create_community_registration_campaign_v1(...)`.

The plaintext capability is returned to the authenticated operator only in the
immediate Server Action success response so the launch modal can render:

`/entry/register/<slug>/access?token=<capability>`

The plaintext token is not stored in Supabase, localStorage, sessionStorage,
Brain, diagnostics or logs.

After reload, the same plaintext link cannot be safely redisplayed with the
current architecture because the database intentionally stores token hashes
only and no token rotation/regeneration UI exists in this slice.

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

Campaign creation and unit attachment are two existing RPC calls. Each RPC is
transactional individually, but the UI layer does not have a single database
transaction spanning both calls.

If campaign creation succeeds and unit attachment fails, the action returns a
specific operator error and withholds the registration link. It does not invent
destructive rollback behavior outside the approved backend.

## Explicit Non-Scope

This mission does not build:

- review UI;
- patronato confirmation UI;
- conversion management UI;
- token rotation/regeneration UI;
- ENTRY mobile changes;
- Supabase migrations;
- Vercel/env/Upstash changes.

## Follow-Up Findings

FOLLOW-UP 1:
Newly created/incomplete community may surface as Needs attention instead of
Pending setup.

FOLLOW-UP 2:
Assign resident admin may be offered when zero eligible residents/users exist.

No fix was made for these findings in `ENTRY-ONB-007`.
