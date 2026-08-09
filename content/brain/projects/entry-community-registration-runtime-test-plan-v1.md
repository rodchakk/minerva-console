# ENTRY Community Registration Runtime Test Plan v1

**Mission:** `ENTRY-ONB-005-RUNTIME-HARNESS`
**Repository/worktree:** `D:\Dev\minerva-console\.worktrees\entry-onb-005`
**Branch:** `codex/entry-onb-005-hosted-dev-validation`
**Baseline:** `0a666cf10ff286db34b24ae9dd773486d628056e`
**Status:** completed against hosted dev; `ENTRY-ONB-005 - HOSTED RUNTIME PASS`.

## 1. Objective

Prepare and execute a reproducible SQL harness for hosted-dev runtime
validation of the Community Registration backend. The harness validates
campaign setup, public registration, review, correction, patronato
confirmation, conversion to `resident_activation_queue`, and safety invariants,
using only synthetic data inside one transaction.

The hosted runtime pass is complete. Execution used `psql` through the
Supavisor Session Pooler on a single connection with `ON_ERROR_STOP=1`.

## 2. Baseline

Hosted dev project:

```text
name = gate-project-dev
ref = ytzvislhvrcdtkbtpbmu
postgres = 17.6
```

Installed migrations:

```text
20260806232141_create_entry_community_registration_schema_v1
20260806233000_create_entry_community_registration_backend_v1
20260806234000_create_entry_community_registration_review_v1
20260806235000_create_entry_community_registration_conversion_v1
20260806235500_hotfix_cr_unit_conversion_queue_uuid_aggregate
20260806235600_hotfix_cr_unit_conversion_user_role_enum_literal
```

Expected starting counts:

```text
resident_activation_queue = 194
auth.users = 313
profiles = 304
community_members = 303
house_residents = 332
resident_activation_pins = 63
```

Expected RAQ distribution:

```text
activated = 15
invited = 29
pending = 132
pin_generated = 18

excel_import = 20
excel_import_v2 = 174
```

All 194 pre-existing RAQ rows must have `community_registration_resident_id IS NULL`.

## 3. RPC Contracts Observed

The four canonical migrations were inspected. The new Community Registration RPCs are `SECURITY DEFINER`, set `search_path` to `public`, call `_cr_service_role_only_v1()`, revoke execution from `public`, `anon`, and `authenticated`, and grant execution to `service_role`.

The actor contract is separate from execution auth. Internal mutating functions validate only that `p_actor_user_id` exists in `auth.users`; they do not require writing to or modifying that user.

## 4. Tables Involved

Live read-only catalog inspection covered:

- `auth.users`
- `public.communities`
- `public.houses`
- `public.community_registration_campaigns`
- `public.community_registration_units`
- `public.community_registration_submissions`
- `public.community_registration_residents`
- `public.community_registration_access_tokens`
- `public.community_registration_reviews`
- `public.community_registration_incomplete_confirmation_authorizations`
- `public.community_registration_events`
- `public.resident_activation_queue`
- `public.profiles`
- `public.community_members`
- `public.house_residents`
- `public.resident_activation_pins`

Fixture columns for `communities` and `houses` are known from hosted catalog inspection: `communities` requires `name`, `community_code`, `is_active`, `gate_status`, and `unit_label` with defaults for the last three; `houses` requires `community_id` and `house_label`.

## 5. Actor Strategy

The harness selects an actor dynamically:

```sql
select id
from auth.users
where deleted_at is null
order by created_at nulls last, id
limit 1;
```

Only the UUID is used, and it is not printed as PII. The account is not modified. If no actor UUID exists, the harness aborts.

## 6. Fixture Design

The harness creates synthetic rows inside the transaction:

- Main synthetic community: `Runtime Test Community ENTRY-ONB-005-RUNTIME ...`
- Foreign synthetic community for cross-campaign negative testing.
- Main houses: `Casa RT-001 ...` and `Casa RT-002 ...`
- Foreign house: `Casa RT-999 ...`
- Main campaign with two units.
- Foreign campaign with one unit.
- Hash-only synthetic campaign, patronato, edit, and expired-edit token values derived with `md5(...)`.
- Fully fictitious residents: `Ana Runtime`, `Carlos Runtime`, `Reset Runtime`.
- Reserved test marker: `ENTRY-ONB-005-RUNTIME`.

The main unit is the happy path. The secondary unit is submitted and then reset so `reset_community_registration_unit_v1` is covered without blocking the final positive conversion path.

## 7. Positive Flow

The harness asserts each step:

1. Create campaign.
2. Add two campaign units.
3. Resolve campaign by slug and token hash.
4. Look up a valid house.
5. Submit initial residents for the main unit.
6. Submit one resident for the secondary reset unit.
7. Read unit state.
8. Start review.
9. Create patronato access.
10. Resolve patronato access.
11. List review units.
12. Read review summary.
13. Read review unit detail.
14. Request correction.
15. Enable resident edit.
16. Resolve edit token.
17. Resubmit corrected residents.
18. Mark the main unit reviewed.
19. Confirm the main unit.
20. Reset the secondary unit.
21. Authorize incomplete confirmation for the one unregistered synthetic unit.
22. Confirm campaign.
23. List units pending conversion.
24. Preview conversion.
25. Convert to RAQ.
26. Re-run conversion to prove idempotent replay.
27. Get conversion result.
28. Mark campaign processed.
29. Verify required event traceability.

## 8. Negative Cases

The harness covers:

- Missing slug.
- Wrong campaign token hash.
- Missing house.
- Resident count over limit.
- Invalid resident payload.
- Resubmission without a valid edit token.
- Expired edit token.
- Wrong patronato token.
- Campaign confirmation while a unit is still pending.
- Conversion before campaign confirmation.
- Conversion replay / idempotency.
- Operating on a unit from another campaign.
- Unauthorized role context.
- Duplicate RAQ row for the same `community_registration_resident_id`.

Errors are checked with controlled `pg_temp.expect_error(...)` blocks so one expected failure does not abort the full harness.

## 9. Assertions

The SQL creates temporary helpers only in `pg_temp`:

- `pg_temp.note(...)`
- `pg_temp.assert_true(...)`
- `pg_temp.assert_equals(...)`
- `pg_temp.expect_error(...)`

Each assertion records its step in `pg_temp.runtime_assertions`. A structured JSON summary is printed immediately before rollback.

## 10. RAQ Invariants

The harness snapshots all pre-existing RAQ IDs before fixtures. Before rollback it asserts:

- `auth.users`, `profiles`, `community_members`, `house_residents`, and `resident_activation_pins` have zero delta.
- RAQ delta is exactly two synthetic rows.
- All 194 baseline RAQ rows still have `community_registration_resident_id IS NULL`.
- New RAQ rows are linked with non-null `community_registration_resident_id`.
- New RAQ rows use `source = 'community_registration_v1'`.
- New RAQ rows remain `pending`.
- Secondary reset-unit residents remain `not_ready` and unlinked.
- Repeated conversion does not create additional RAQ rows.

## 11. Transaction Strategy

The script starts with:

```sql
begin;
```

It ends with:

```sql
rollback;
```

The harness contains no transaction-finalizing success statement. Rollback is the cleanup mechanism. No permanent helper functions are created.

## 12. Risks

- The direct fixture inserts into `communities` and `houses` require a privileged hosted SQL execution context.
- The service-role RPC contract depends on `auth.role()`, so the harness sets the local JWT role setting to `service_role` for positive and most negative cases.
- If hosted-dev baseline counts change before execution, the harness should abort at the baseline assertions.
- If `communities` or `houses` constraints change after this preparation, fixture creation may need revision.
- The unauthorized-role test simulates `auth.role() = 'anon'` inside the SQL session; it validates the internal RPC gate and grant expectations are separately covered by catalog inspection.

## 13. Execution Procedure

1. Confirm `git rev-parse HEAD` is `0a666cf10ff286db34b24ae9dd773486d628056e` or the reviewed successor.
2. Confirm the SQL file has not changed since review.
3. Confirm hosted-dev migration history contains canonical migrations `001-006`.
4. Confirm baseline row counts and RAQ distribution still match this plan.
5. Execute `supabase/tests/entry-onb-005-runtime.sql` once against `gate-project-dev` using an approved hosted SQL channel with backend/service-role semantics.
6. Review the JSON summary emitted before rollback.
7. Run the post-rollback verification query below.

## 14. Post-Rollback Verification Query

Run read-only after the harness returns:

```sql
select 'auth.users' as table_name, count(*)::bigint as row_count from auth.users
union all
select 'profiles', count(*)::bigint from public.profiles
union all
select 'community_members', count(*)::bigint from public.community_members
union all
select 'house_residents', count(*)::bigint from public.house_residents
union all
select 'resident_activation_pins', count(*)::bigint from public.resident_activation_pins
union all
select 'resident_activation_queue', count(*)::bigint from public.resident_activation_queue;

select status, count(*)::bigint
from public.resident_activation_queue
group by status
order by status;

select source, count(*)::bigint
from public.resident_activation_queue
group by source
order by source;

select count(*)::bigint as legacy_source_id_null_count
from public.resident_activation_queue
where community_registration_resident_id is null;

select count(*)::bigint as runtime_marker_rows
from public.resident_activation_queue
where raw_data::text like '%ENTRY-ONB-005-RUNTIME%';
```

Expected results after rollback: original baseline counts, original RAQ distribution, `legacy_source_id_null_count = 194`, and `runtime_marker_rows = 0`.

## 14.1 Runtime Result

The first hosted runtime attempt exposed a PostgreSQL aggregate resolution
failure in `public._cr_classify_unit_conversion_v1(uuid)`:

```text
ERROR: function min(uuid) does not exist
```

Hotfix `20260806235500_hotfix_cr_unit_conversion_queue_uuid_aggregate.sql`
preserved the classifier semantics by replacing `count + min(q.id) +
min(q.status)` with `matching_queue -> queue_count -> queue_candidate`.

The second hosted runtime attempt exposed an enum literal casing failure in the
same classifier:

```text
ERROR: invalid input value for enum user_role: "resident"
```

Hotfix `20260806235600_hotfix_cr_unit_conversion_user_role_enum_literal.sql`
changed the comparison to `cm.role = 'RESIDENT'::public.user_role`.

After both hotfixes, the full harness passed:

```text
assertions_passed = 75

deltas_before_rollback:
profiles = 0
auth.users = 0
house_residents = 0
community_members = 0
resident_activation_pins = 0
resident_activation_queue = 2

ROLLBACK
```

The `resident_activation_queue` delta of `+2` is expected and limited to the
two synthetic conversion rows inside the transaction.

Independent post-runtime verification confirmed rollback cleanup:

```text
resident_activation_queue = 194
auth.users = 313
profiles = 304
community_members = 303
house_residents = 332
resident_activation_pins = 63
legacy RAQ null source ids = 194

runtime campaigns = 0
runtime units = 0
runtime events = 0
```

## 15. Approval Criteria

- Met: all 75 assertions passed.
- Met: the summary reported zero deltas for active user tables and PINs.
- Met: RAQ delta before rollback was exactly two synthetic linked rows.
- Met: post-rollback verification returned the exact baseline.
- Met: no tokens, users, PINs, emails, invitations, external calls, or UI paths were created.
- Met: runtime behavior matches the documented RPC contract after hotfixes `005` and `006`.

## 16. Abort Criteria

Abort before execution if:

- The script contains a transaction-finalizing success statement.
- A migration `001-004` must be modified.
- The test requires inserting into `auth.users`.
- The test requires real secrets or plaintext production tokens.
- The test requires deleting existing rows.
- Rollback cannot be guaranteed.
- A real community would be used.
- Remote baseline counts changed unexpectedly.
- Dry inspection detects unrelated local changes.

## 17. Completed

This harness has been executed against hosted dev and passed. Temporary
fixtures were created only inside the transaction and rolled back. No grants
were changed, no application/UI code changed, ENTRY mobile remains untouched,
no UI work began, and no push, PR, deployment, stage, or local commit was
performed in this closeout pass. The public registration architecture remains
mediated through secure service-role backend RPCs and remains stopped at
`resident_activation_queue`.
