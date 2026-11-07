# ENTRY unit relationships — Phase 3 evidence (2026-11-07)

## Implementation boundary

The rename action delegates only to `manage_entry_unit_relationship_v1`. Its input no longer accepts a primary resident. Console and Field use this same action. The previous direct `houses.house_label` fallback is removed. The legacy dialog now has separate Save label, Save reference and Save primary resident confirmations; each invokes exactly one operation and closes on success. A failed label save cannot partially save a reference or residency change.

The existing primary-resident implementation is retained behind a separate authenticated action. It still uses two updates of `house_residents.is_primary`; its preexisting partial-failure risk and the distinction from `is_primary_contact` are not repaired in this MVP. Rename never calls that action. This is an explicit remaining limitation of the existing primary-resident feature, not an authorization to change residential semantics.

The action behavior test executes the transpiled server action with an administrative-client trap and a malicious extra `primaryResidentUserId`: only the rename RPC is called. SQL integration independently checks resident and non-resident data preservation.

## Local Supabase evidence and provenance

Installed/invoked pinned CLI `supabase@3.0.0` through npx, without changing application dependencies. Created an independent project at `D:/Dev/entry-relationships-phase3-lab`, project ID `entry-relationships-phase3-lab`, API `127.0.0.1:56321`, PostgreSQL `127.0.0.1:56322`. Auth, PostgREST, Kong and PostgreSQL run as separate local containers. No hosted project was linked; no production credentials or data were used.

Source: schema-only dump of the existing **local** `supabase_db_local-dev`, whose migration ledger contains `00000000000000 / entry_prod_schema_baseline`. The source container was only read. Public-schema dump SHA256: `E54033C055896E02B758BF7D61C37E4A4E7560E325A38BAD703F0A807450D0AD`.

The repository starts with replacement functions that already reference communities/houses; it is not a complete genesis migration chain. Therefore historical migrations were not replayed blindly. The lab restored the known public schema, installed its required `btree_gist` extension, restored role-specific default privileges as local `supabase_admin`, then applied `20261106090000_entry_unit_relationships_mvp.sql` as postgres. Initial restoration exposed those two prerequisites; both were resolved before final tests.

This baseline includes the real `is_superadmin`, normalization helpers, house protection and registration snapshot triggers. Auth itself is the real Supabase service; users are created through its admin API and sign in with passwords to obtain actual JWTs. No replacement `auth.uid()` or mocked authorization helper is used in this integration test.

Limits: the source baseline's freshness against today's hosted schema is unknown. Only public schema was copied; custom production Auth-schema triggers and external integrations were not reconstructed. This proves local Auth/PostgREST/RLS integration on the known baseline, **not exact production equivalence**. Browser interaction with the local Console was not executed; TypeScript, build, server-action behavior and HTTP database contracts were exercised.

## Executable integration

After restoring the known schema and applying the migration in the isolated lab:

```powershell
$env:ENTRY_RELATIONSHIPS_LAB = 'D:/Dev/entry-relationships-phase3-lab'
node supabase/tests/unit-relationships-local.mjs
```

The script refuses any API URL except `http://127.0.0.1:56321`, uses only the fixed lab container, creates random synthetic identities/communities and reads local credentials from the lab's untracked `start.log`. It may be rerun; each run creates its own fixtures. No real community identifiers are present.

Assertions cover default-disabled RPCs, anonymous and non-superadmin denial, authenticated SELECT RLS after inserting data, service-role DELETE denial, cross-community/self-link/missing-unit rejection, membership checks, two concurrent reversed links yielding one identity and one creation, responsibility removal/reassignment, link end/relink history, historical PATCH denial, and atomic rollback on an injected audit failure.

Rename fixtures contain a primary resident, profile/contact, visit pass with QR token, financial entry and closed registration snapshot. Renaming Apartamento 1 to Casa 2009 preserves the house UUID and every house field except label/update timestamp. It compares all other public tables byte-for-byte (ordered JSON), excluding only the explicit audit table. Pending activation and open/unregistered campaign rows reject rename. Closed registration snapshots remain unchanged. Stale expected labels reject.

## Scope tests and regression comparison

Three older branch-scope tests prohibited all ENTRY changes/migrations. Their assertions now exempt an exact reviewed list of ten MVP file paths; Brain, public registration, authorization and all other migrations remain prohibited. A negative test rejects unrelated paths. Two existing rename tests were adapted to the separated primary-resident contract and the RPC's locked lookup/not-found rejection, preserving their functional invariants.

Base `e37d5504`: 742 total, 698 pass, 44 fail. Phase 3: 746 total, 702 pass, 44 fail. Compare failure **names**, since imports move line numbers. No new failing names. The four focused MVP tests pass. Focused ESLint, route type generation, TypeScript and production build pass. Existing workspace-root/NFT warnings remain. These local results do not claim green hosted CI.

Both suites used Node `v24.16.0` and the same installed dependencies. This runtime is below package.json's declared minimum `24.22.1`; a supported-runtime CI run remains required. Per-test classifications are recorded in [the comparison evidence](entry-unit-relationships-phase3-failures.md). The 44 failures are preexisting relative to this base; this comparison does not attribute their original causes to any concurrent PR.

## Compatibility and simplicity review

PR #308 (Activation Queue) and #292 (inactive-unit assignment guard) have no changed-file overlap with this MVP at the reviewed heads. No concurrent changes were merged. Integrate through normal review, recheck the diff after either PR changes, and rerun the activation-dependency rename guards after integration. Mergeability alone is not a behavioral compatibility test.

Both unit and person paths retain the shared management RPC. No new tables, frameworks or association abstractions were introduced in Phase 3. Removed the unsafe direct rename fallback; retained existing residential workflows separately. Person panels remount on person/community changes, failed loads and uncertain mutation results display messages, and successful unit changes refresh the view. Browser acceptance remains pending, including empty/error states, selection and navigation on both paths.

## Deployment and rollback prerequisites — not executed

1. Independently compare the target schema's FKs, grants, `is_superadmin`, normalizers and house/registration triggers with the tested baseline. Verify no existing relation tables or conflicting migration version. Review the primary-resident limitation separately.
2. Apply the additive migration **before** publishing application code. Verify both flags remain false; this migration does not enable any community. Verify table DML is revoked from anon/authenticated/service_role, explicit SELECT grants, RPC grants and superadmin/gate checks.
3. Publish application only after schema checks. Before migration, relationship reads show an unavailable message and rename RPC calls fail without writing. There is no direct-write fallback. Existing label editing remains available through the audited RPC even when associations are disabled; the flag gates association operations and reads, not the preexisting rename capability.
4. Complete a browser acceptance session against the isolated stack. Resolve or explicitly accept the 44 baseline failures through the normal review process. Obtain separate authorization before any pilot flag change.

Disable the community flag to stop relationship RPC writes and authenticated reads. Revert application code if needed; retain additive tables and audit history. Do not drop tables to roll back. Historical composite FKs use RESTRICT: deleting a linked house, community, membership or actor may now fail even after unlinking. This preserves traceability but requires review of existing deletion/offboarding procedures before rollout. Database owners can still administer rows; the runtime API roles cannot silently rewrite or delete history.

No production migration, community enablement, merge or deployment is included. Paradis and Andalucía were not accessed or modified. Recommendation: ready for independent technical review; NO-GO for pilot until the schema-drift and browser acceptance gates above are closed.
