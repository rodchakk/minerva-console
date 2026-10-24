# ENTRY — Inactive unit enrollment guard (review required)

## Scope

Protect **new active resident assignments** from selecting an inactive unit,
regardless of whether they originate in Minerva Console, Field, Entry Web,
PIN activation, a direct database RPC or an invite. Existing resident data,
access logs, credentials, and inactive units are not rewritten.

Incident prompting this change: **Residencial Paradis / Casa 2008 / Robert Plant**.
A resident was activated on 22 Oct 2026 despite the unit being inactive. The
admin reactivated Casa 2008 subsequently; read-only verification found
`houses.is_active=true`.

## Implementation (staged, NOT deployed)

- One `SECURITY DEFINER` helper checks `houses.id`, `community_id` and
  `is_active=true`, acquiring `FOR SHARE` to serialize with unit status
  updates and prevent a check/write race. No new public RPC privileges.
- Triggers block new **active** `profiles` and `house_residents` bindings,
  pending `resident_activation_pins` (including regeneration) and new
  `resident_invites` for inactive/mismatched units.
- Existing inactive resident records remain untouched. Deactivating a unit is
  still permitted; subsequent reactivations work because unit activation is
  performed before account activation in existing unit-toggle RPCs.
- `resident_activation_queue` can retain imported **pending** rows for
  inactive units; actual PIN/invitation/account issuance is disallowed.
- PIN generation errors map `house_inactive` to a clear admin message.

### Important cross-service deployment caveat

The current `activate-account-by-code` Supabase Edge Function (v24 at
investigation time) may create an `auth.users` user via the Auth Admin API
**before** inserting an active `profiles` row when claiming a legacy
`resident_invites` link. The DB guard rejects the profile insert but cannot
rollback a separate Auth Admin API transaction. **Before marking this fully
release-ready, add an early active-house preflight to that Edge flow (and an
idempotent orphan-cleanup/compensation strategy), then test it on staging.**
Do not silently claim that the SQL migration eliminates all orphan-account
risks. Test other external Auth Admin creation routes similarly.

## Staging/QA matrix (required before production)

1. Active house: PIN generation, PIN completion, invite issuance, direct user
   creation and resident move all still work.
2. Inactive house: pending queue data can exist but PIN generation and new
   invitations reject with `house_inactive`, no PIN created; direct profile
   insert and active house_residents link reject; no active assignment remains.
3. Generate PIN while active, then deactivate unit: PIN completion cannot
   make an active resident; no partially created database identity.
4. Concurrent unit deactivation and resident assignment: lock prevents
   assignment to an inactive unit; verify no deadlocks with unit toggles.
5. Unit reactivation: preexisting residents are re-enabled by the established
   admin workflow; existing history is preserved.
6. Cross-community house IDs and nonexistent houses reject. Repeated writes
   to unrelated fields of existing residents must not get blocked.
7. Verify the legacy invitation Edge path and other external Auth Admin
   workflows do not leave auth-only orphan identities on guard rejection.
8. Run app tests, build and Supabase staging migration/rollback rehearsal,
   audit permissions and migration ledger against Supabase production.

## Release boundary

- **No database migration executed**, no Supabase Edge redeploy, no house or
  user mutation, no production release from this PR.
- This is distinct from the security hotfix of Entry Admin Web; do not merge
  into that release without integration and owner approval.
- The production migration ledger previously differed substantially from a
  local checkout. Confirm migration ordering and IDs before rollout.
- Database rollback: drop these four triggers and their two functions only
  after evaluating dependent usage. Do not change historical resident rows.
