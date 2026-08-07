# ENTRY Resident Activation Queue Live Contract

**Mission:** `ENTRY-ONB-004-UNBLOCK`
**Date:** 2026-08-06
**Repository/worktree:** `D:\Dev\minerva-console\.worktrees\entry-onb-004`
**Supabase project:** `gate-project-dev`
**Project ref:** `ytzvislhvrcdtkbtpbmu`
**Project status observed:** `ACTIVE_HEALTHY`
**Database observed:** PostgreSQL `17.6.1.063`
**Status:** read-only contract capture; no migration applied.

## 1. Summary

This document captures the live activation queue contract needed to resume
`ENTRY-ONB-004` without inventing fields or semantics.

Inspection was read-only and limited to catalog metadata and function
definitions. No operational activation rows, resident names, emails, phones,
PINs, tokens or queue payloads were selected or stored.

`resident_activation_queue` is confirmed as the canonical prepared-resident
boundary. Community Registration conversion must stop at queue rows and must
not create Auth users, profiles, community memberships, house residents, PINs
or activation messages.

## 2. Read-Only Scope

Permitted inspection used only:

- Supabase project listing for identity and status.
- `information_schema.columns`.
- `information_schema.table_privileges`.
- `information_schema.routine_privileges`.
- `pg_catalog` metadata for constraints, indexes, triggers, RLS, functions and
  function definitions.

No `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, DDL, migration, RLS change, grant
change, Auth change, Edge Function deployment or data export was performed.

## 3. `resident_activation_queue` Columns

| Ordinal | Column | Type | Nullable | Default |
| ---: | --- | --- | --- | --- |
| 1 | `id` | `uuid` | no | `gen_random_uuid()` |
| 2 | `community_id` | `uuid` | no | none |
| 3 | `house_id` | `uuid` | yes | none |
| 4 | `unit_label` | `text` | no | none |
| 5 | `resident_name` | `text` | no | none |
| 6 | `phone` | `text` | yes | none |
| 7 | `email` | `text` | yes | none |
| 8 | `is_owner_reference` | `boolean` | yes | `false` |
| 9 | `suggested_username` | `text` | yes | none |
| 10 | `activation_method` | `text` | no | `'unknown'::text` |
| 11 | `status` | `text` | no | `'pending'::text` |
| 12 | `activation_code_id` | `uuid` | yes | none |
| 13 | `invite_sent_at` | `timestamptz` | yes | none |
| 14 | `processed_at` | `timestamptz` | yes | none |
| 15 | `last_error` | `text` | yes | none |
| 16 | `source` | `text` | no | `'excel_import'::text` |
| 17 | `raw_data` | `jsonb` | no | `'{}'::jsonb` |
| 18 | `created_by` | `uuid` | yes | none |
| 19 | `created_at` | `timestamptz` | no | `now()` |
| 20 | `updated_at` | `timestamptz` | no | `now()` |
| 21 | `activated_user_id` | `uuid` | yes | none |

## 4. Checks And Foreign Keys

Checks:

- `resident_activation_queue_activation_method_check`:
  `activation_method in ('email', 'username_pin', 'phone_pin', 'unknown')`.
- `resident_activation_queue_status_check`:
  `status in ('pending', 'invited', 'pin_generated', 'activated', 'skipped', 'failed')`.

Foreign keys:

- `community_id` references `public.communities(id)` with `ON DELETE CASCADE`.
- `house_id` references `public.houses(id)` with `ON DELETE SET NULL`.

Primary key:

- `resident_activation_queue_pkey`: primary key on `id`.

No unique constraint or unique index was observed that represents a pending
resident identity by community, house, unit, resident name, email or phone.

## 5. Indexes

| Index | Definition |
| --- | --- |
| `resident_activation_queue_pkey` | Unique btree on `id`. |
| `idx_raq_community_id` | Btree on `community_id`. |
| `idx_raq_status` | Btree on `status`. |
| `idx_raq_email` | Btree on `email` where `email is not null`. |
| `idx_raq_phone` | Btree on `phone` where `phone is not null`. |
| `idx_raq_activated_user_id` | Btree on `activated_user_id` where `activated_user_id is not null`. |
| `idx_raq_unit_label_lower` | Btree on `lower(unit_label)`. |
| `idx_raq_community_normalized_unit_label` | Btree on `(community_id, normalize_unit_label(unit_label))`. |
| `idx_raq_suggested_username_lower` | Btree on `lower(suggested_username)` where `suggested_username is not null`. |

## 6. RLS, Policies And Table Grants

RLS:

- `resident_activation_queue` has RLS enabled.
- Force RLS is not enabled.

Policy:

- `superadmin_all`
- Roles: `authenticated`
- Command: `ALL`
- `USING`: `is_superadmin()`
- `WITH CHECK`: `is_superadmin()`

Table grants:

- `anon`, `authenticated`, `service_role` and `postgres` have base table
  privileges in the catalog.
- Effective non-service access is still constrained by RLS and the
  `superadmin_all` policy.
- This is not authorization for Community Registration to use direct table
  access. New Community Registration RPCs must remain `SECURITY DEFINER`,
  service-role callable only, and must not grant execution to `PUBLIC`, `anon`
  or `authenticated`.

## 7. RAQ Triggers

Observed triggers:

- `trg_raq_updated_at`: before update, executes `set_updated_at()`.
- `trg_raq_ensure_email_identity`: after insert or update of
  `status, activated_user_id`, executes
  `ensure_resident_activation_email_identity()`.

`ensure_resident_activation_email_identity()` returns immediately unless
`new.status = 'activated'` and `new.activated_user_id is not null`. Therefore
Community Registration conversion to `status='pending'` should not trigger
Auth identity repair or welcome notification side effects.

## 8. `confirm_resident_bulk_import_v1`

Signature:

```text
public.confirm_resident_bulk_import_v1(
  p_community_id uuid,
  p_rows jsonb,
  p_create_missing_units boolean default true
) returns jsonb
```

Catalog:

- Language: `plpgsql`.
- `SECURITY DEFINER`: yes.
- `search_path`: `public, extensions`.
- Owner: `postgres`.
- Grants observed: `PUBLIC`, `anon`, `authenticated`, `postgres`,
  `service_role`.

Security and validation:

- Requires `public.is_superadmin()`.
- Verifies the community exists.
- Requires `p_rows` to be a JSON array.
- Per row, validates unit label, resident name and email shape.

Normalization:

- Unit label is normalized with `public.normalize_unit_label`.
- Email is lowercased and trimmed.

Writes:

- May insert into `public.houses` when `p_create_missing_units` is true and no
  matching normalized house exists.
- Inserts into `public.resident_activation_queue`.
- Writes audit through `public._sa_audit_log`.

RAQ insert contract:

- `community_id`
- `house_id`
- `unit_label`
- `resident_name`
- `phone`
- `email`
- `is_owner_reference`
- `suggested_username`
- `activation_method`
- `status = 'pending'`
- `source = 'excel_import_v2'`
- `raw_data`
- `created_by = auth.uid()`

Deduplication:

- Checks existing RAQ rows in the same community and normalized unit label.
- Requires `lower(q.resident_name) = lower(v_resident_name)`.
- Considers statuses `pending`, `invited`, `pin_generated`, `activated`.
- Contact condition is email match if email exists, phone match if email is
  null and phone exists, or name/unit only when both email and phone are null.

Return:

- Counts for inserted, failed, skipped duplicates, missing units created and
  missing units not created.
- Per-row results.

Reuse decision:

`ENTRY-ONB-004` should not reuse this importer as a black box. It can create
houses, stores source as `excel_import_v2`, copies importer-shaped raw data,
does not preserve a direct Community Registration FK, and cannot provide
structural idempotency by `community_registration_resident`.

## 9. `list_resident_activation_queue_v1`

Signature:

```text
public.list_resident_activation_queue_v1(
  p_community_id uuid,
  p_status text default null
) returns table (
  id uuid,
  community_id uuid,
  house_id uuid,
  unit_label text,
  resident_name text,
  phone text,
  email text,
  is_owner_reference boolean,
  suggested_username text,
  activation_method text,
  status text,
  invite_sent_at timestamptz,
  processed_at timestamptz,
  last_error text,
  created_at timestamptz
)
```

Catalog:

- Language: `plpgsql`.
- `SECURITY DEFINER`: yes.
- `search_path`: `public`.
- Owner: `postgres`.
- Grants observed: `authenticated`, `postgres`, `service_role`.

Behavior:

- Requires `public.is_superadmin()`.
- Reads `public.resident_activation_queue`.
- Filters by `community_id`.
- Applies optional exact status filter.
- Orders by `created_at asc`.
- Does not mutate data.

## 10. `generate_resident_activation_pins_v1`

Signature:

```text
public.generate_resident_activation_pins_v1(
  p_community_id uuid,
  p_queue_ids uuid[]
) returns jsonb
```

Catalog:

- Language: `plpgsql`.
- `SECURITY DEFINER`: yes.
- `search_path`: `public, extensions`.
- Owner: `postgres`.
- Grants observed: `authenticated`, `postgres`, `service_role`.

Behavior:

- Requires `public.is_superadmin()`.
- Verifies community exists.
- Processes queue IDs one by one.
- Reads queue rows and rejects cross-community rows.
- Skips terminal RAQ statuses `activated` and `skipped`.
- Determines method as `email`, `phone_pin` or `username_pin`.
- Calls `_raq_suggest_username` when PIN-method username is missing.
- Inserts or replaces one pending row in `resident_activation_pins`.
- Updates RAQ status to `pin_generated`, updates activation method and username,
  clears `last_error`, updates `updated_at`.
- Audits via `_sa_audit_log`.

It does not create `auth.users`, `profiles` or `community_members`.

PIN table support:

- `resident_activation_pins` has a unique partial index on `queue_id` where
  `status = 'pending'`.
- Statuses are `pending`, `used`, `expired`.

## 11. `complete_resident_activation_pin_v1`

Signature:

```text
public.complete_resident_activation_pin_v1(
  p_pin text,
  p_password text,
  p_username text default null
) returns jsonb
```

Catalog:

- Language: `plpgsql`.
- `SECURITY DEFINER`: yes.
- `search_path`: `public, extensions`.
- Owner: `postgres`.
- Grants observed: `anon`, `authenticated`, `postgres`, `service_role`.

Behavior:

- Validates PIN format and password length.
- Rate-limits through `security_event_log`.
- Uses an advisory transaction lock by PIN hash.
- Finds a pending, unexpired PIN by bcrypt comparison.
- Locks the PIN row and then the RAQ row with `FOR UPDATE`.
- Rejects already activated or skipped queue rows.
- Requires `house_id`.
- Determines email or username auth.
- Checks `auth.users` for email collision.
- Inserts `auth.users`.
- Inserts `public.profiles`.
- Inserts `public.community_members`.
- Inserts or updates `public.house_residents`.
- Marks the PIN `used`.
- Marks RAQ `activated`, sets `activated_user_id`, `processed_at`, clears
  `last_error`, updates `updated_at`.
- Writes security events for success and failure.

This confirms Community Registration conversion must stop before this function:
it should prepare RAQ rows only, not activate users.

## 12. Normalization

`normalize_unit_label(p_label text) returns text`:

- Language: `sql`.
- Immutable and parallel safe.
- Not `SECURITY DEFINER`.
- Owner: `postgres`.
- Grants observed: `PUBLIC`, `anon`, `authenticated`, `postgres`,
  `service_role`.

Semantics:

```text
lower(regexp_replace(regexp_replace(trim(coalesce(label, '')), '\s+', '', 'g'), '[^[:alnum:]]', '', 'g'))
```

`ENTRY-ONB-004` should use this live helper when matching existing houses and
RAQ rows, rather than a divergent local-only approximation.

## 13. Username Helper

`_raq_suggest_username(p_resident_name text, p_community_id uuid) returns text`:

- Language: `plpgsql`.
- Stable.
- `SECURITY DEFINER`: yes.
- `search_path`: `public, extensions`.
- Owner: `postgres`.
- Grants observed: `authenticated`, `postgres`, `service_role`.

Semantics:

- Splits the resident name into words.
- Uses first word and last word.
- Removes accents and non-alphanumeric characters.
- Uses first initial plus last name, or the single cleaned word.
- Tries the base username, then numeric suffixes up to 99.
- Checks `public.profiles.username` for collisions.
- Falls back to a random four-digit suffix.

For `ENTRY-ONB-004`, this helper may be used to generate a suggested username
when inserting PIN-method RAQ rows, but the conversion must still account for
queue-level username collision checks performed later by PIN generation.

## 14. Active User Contract

### `auth.users`

Relevant metadata only:

- `id uuid not null`, primary key.
- `email varchar(255) nullable`.
- `phone text nullable`.
- Unique phone constraint/index: `users_phone_key`.
- Unique email index: `users_email_partial_key` on `email` where
  `is_sso_user = false`.
- Lookup index: `(instance_id, lower(email))`.

### `profiles`

Relevant columns:

- `user_id uuid not null`, primary key and FK to `auth.users(id)`.
- `community_id uuid not null`, FK to `communities(id)` with `ON DELETE RESTRICT`.
- `role public.user_role not null`.
- `house_id uuid nullable`, FK to `houses(id)` with `ON DELETE SET NULL`.
- `full_name text not null`.
- `phone text nullable`.
- `username text nullable`.
- `auth_type text not null default 'email'`.
- `is_active boolean not null default true`.
- `synthetic_email text nullable`.

Relevant constraints/indexes:

- `profiles_auth_type_check`: `auth_type in ('email', 'username')`.
- Unique global username index where username is not null.
- Unique synthetic email index where synthetic email is not null.
- Indexes on community, house, role and `(user_id, is_active)`.

### `community_members`

Relevant columns:

- `id uuid primary key default gen_random_uuid()`.
- `community_id uuid not null`, FK to `communities(id)` with `ON DELETE CASCADE`.
- `user_id uuid not null`, FK to `auth.users(id)` with `ON DELETE CASCADE`.
- `role public.user_role not null`.
- `is_active boolean not null default true`.

Relevant constraint:

- Unique `(community_id, user_id)`.

This permits one user to belong to multiple communities through separate rows.

### `house_residents`

Relevant columns:

- `id uuid primary key default gen_random_uuid()`.
- `community_id uuid not null`, FK to `communities(id)` with `ON DELETE CASCADE`.
- `house_id uuid not null`, FK to `houses(id)` with `ON DELETE CASCADE`.
- `user_id uuid not null`, FK to `auth.users(id)` with `ON DELETE CASCADE`.
- `is_primary boolean not null default true`.
- `is_active boolean not null default true`.

Relevant constraints/indexes:

- Unique `(user_id, community_id, house_id)`.
- Unique active primary per `(user_id, community_id)` where active and primary.
- Unique active assignment per `(user_id, house_id)` where active.

## 15. Existing Resident Detection For `ENTRY-ONB-004`

`ENTRY-ONB-004` should distinguish two checks:

Idempotency:

- Exact Community Registration resident identity.
- Should be structurally guaranteed by a dedicated identifier, not just a
  pre-insert SELECT.

Semantic deduplication:

- Same community.
- Same house or same normalized unit label.
- Same or compatible resident name.
- Email and phone where present.
- RAQ statuses `pending`, `invited`, `pin_generated`, `activated`.
- Active user records across `auth.users`, `profiles`, `community_members` and
  `house_residents`.

Unambiguous semantic matches may be reused. Ambiguous matches should block for
manual review rather than insert another pending activation row.

## 16. Critical Idempotency Finding

`resident_activation_queue` currently has no unique constraint or unique index
that represents the identity of a pending resident.

Consequence:

- A pre-insert duplicate query is useful but not sufficient under concurrency.
- Two writers can race unless `ENTRY-ONB-004` adds a structural defense for its
  own source identity.

## 17. Traceability Recommendation

Recommended future design for `ENTRY-ONB-004`:

Add a nullable dedicated column to `resident_activation_queue`:

```text
community_registration_resident_id uuid nullable
```

with:

- FK to `public.community_registration_residents(id)`.
- Unique index or unique constraint where not null.
- Existing rows remain null.

Rationale:

- Direct traceability.
- Strong idempotency for Community Registration.
- Simple lookup and retry behavior.
- Avoids relying on `raw_data` for identity.

Alternative:

- A unique expression index on `raw_data->>'community_registration_resident_id'`
  for `source='community_registration_v1'`.

The raw-data option avoids a column but is weaker: no FK, weaker type safety,
harder validation and more coupling to JSON shape.

Do not implement either option in this unblock mission.

## 18. Traditional Importer Concurrency Risk

Even with Community Registration idempotency by
`community_registration_resident_id`, the traditional importer can still insert
a semantically equivalent row concurrently because there is no global resident
identity key across all activation sources.

Therefore `ENTRY-ONB-004` should preserve:

- Own-source structural idempotency by Community Registration resident ID.
- Semantic duplicate detection across queue and active users.
- Blocking on ambiguous matches.

It should not impose a global unique constraint based only on name, email or
phone without a false-positive analysis.

## 19. Contract `ENTRY-ONB-004` Must Respect

Conversion may insert RAQ rows only after the campaign, unit and current
submission are confirmed and no active edit/correction path remains.

Insertion target:

- `community_id`
- `house_id`
- `unit_label`
- `resident_name`
- `phone`
- `email`
- `is_owner_reference`
- `suggested_username`
- `activation_method`
- `status = 'pending'`
- `source = 'community_registration_v1'`
- `raw_data` with non-secret source identifiers
- `created_by`
- future `community_registration_resident_id`, if approved in migration 004

Must not write:

- `auth.users`
- `profiles`
- `community_members`
- `house_residents`
- `resident_activation_pins`
- legacy invite/code objects

Must not generate PINs, send invitations or start onboarding campaigns.

## 20. Evidence Used

Live read-only evidence:

- Supabase `_list_projects` confirmed project identity and status.
- Catalog query over `information_schema.columns`.
- Catalog query over `pg_constraint`, `pg_indexes`, `pg_class`,
  `pg_policies` and `information_schema.table_privileges`.
- Catalog query over `pg_proc`, `pg_namespace`, `pg_language`, `pg_roles`.
- Catalog query over `information_schema.routine_privileges`.
- `pg_get_functiondef` for:
  - `confirm_resident_bulk_import_v1`
  - `list_resident_activation_queue_v1`
  - `generate_resident_activation_pins_v1`
  - `complete_resident_activation_pin_v1`
  - `normalize_unit_label`
  - `_raq_suggest_username`
  - `ensure_resident_activation_email_identity`
  - `set_updated_at`
- Trigger metadata for RAQ and active-user tables.

Local context:

- `content/brain/projects/entry-community-registration-foundation-contract.md`
- `content/brain/projects/entry-community-registration-schema-v1.md`
- `content/brain/projects/entry-community-registration-backend-v1.md`
- `content/brain/projects/entry-community-registration-review-v1.md`
- Migrations `20260806232141`, `20260806233000`, `20260806234000`.

No PII-bearing rows were queried or copied.

## 21. Open Questions

- Whether migration 004 should add the dedicated
  `community_registration_resident_id` column directly to RAQ or use a
  transitional expression index on `raw_data`.
- Whether the dedicated FK should be `ON DELETE SET NULL` or `ON DELETE
  RESTRICT`; preserving queue history suggests `SET NULL`, while stronger audit
  traceability suggests `RESTRICT`.
- Whether `ENTRY-ONB-004` should set `suggested_username` at conversion time or
  allow PIN generation to resolve it later for PIN methods.
- Exact active-user semantic duplicate threshold for name-only residents without
  email or phone.

## 22. Verdict

The live activation queue contract is sufficiently captured for `ENTRY-ONB-004`
design to resume without inventing fields.

The apply blocker is resolved for hosted dev. Runtime tests remain pending for
the full migration chain and conversion behavior.

`READY TO RESUME ENTRY-ONB-004`
