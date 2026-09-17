# Field Resident Email Invitation

Branch: `codex/field-resident-email-invitation`, based on master `093915f`.

## Architecture And Preflight

Read-only deployed preflight on `gate-project-dev` inspected both bulk importer definitions, every function inserting into RAQ, indexes, status constraints, Auth email uniqueness, and migration history. Latest recorded migration was `20260917040207`. No duplicate `lower(btrim(email))` values existed across pending, invited, pin_generated, activated, or failed rows.

The three existing writers are `confirm_resident_bulk_import_v1`, `create_resident_activation_queue_bulk_v1`, and `convert_community_registration_unit_to_activation_v1`. All participate through `ux_raq_live_email_identity`, a project-wide partial unique email index. The production migration replaces both bulk functions, preserving signatures and return contracts. Email locks use the shared `entry-raq-email|` namespace, acquired in sorted batch order. Reserved-state duplicates are skipped without mutation; incompatible resident/house/community identities increment row failures and do not abort the batch. Only INSERT violations of `ux_raq_live_email_identity` are re-read and classified; unrelated unique violations propagate. Community Registration's function and structural index remain unchanged. No historical rows are deleted or rewritten. Index creation deliberately fails if conflicting data is present at deployment. Repeat preflight on the actual deployment database before applying through the reviewed deployment process.

`prepare_resident_activation_invite_v1(community_id uuid, house_id uuid, resident_name text, email text, phone text default null)` requires the existing superadmin convention. It validates community and the exact active house, normalizes email, takes transaction-scoped email and resident/unit advisory locks, checks Auth, and reuses compatible queue state. New rows are prepared by the canonical importer with missing-house creation disabled. If label normalization resolves another house, the operation rolls back. Return includes success/error, queue_id, created, status, email, resident_name, house_id, unit_label, and server-derived community_name. No Auth identity, password, PIN, or email is created by this RPC.

Status behavior:

- `pending`, `invited`, `pin_generated`: compatible name/email/community/house rows are reused unchanged.
- `failed`: reused unchanged; canonical PIN/email actions can retry it.
- `activated`: reserves the identity and conflicts with another invitation.
- `skipped`: terminal history is retained and may be superseded if no Auth identity or other reserved row exists.
- Any existing Auth email, incompatible queue context, or different email for the same prepared resident/unit is an explicit conflict.

Field sends email automatically only for a newly created row. Reused rows direct the admin to Activation Queue for explicit send/resend. Delivery uses unchanged `sendActivationEmails` and `generateActivationPins`, ENTRY branding, sender, and activation URL. Resend acceptance sets invited/invite_sent_at using existing semantics. Delivery failure preserves queue state; metadata persistence warnings remain visible. A request interrupted after preparation leaves retryable state in Activation Queue.

No migration was applied to a deployed database. No production data, Guard behavior, native mobile code, email templates, activation URL, or PIN semantics were changed.

## Automated Verification

Run `node --test tests/entry-field-resident-email-invitation.test.mjs` and `node scripts/test-resident-email-invitation-db.mjs` from the repository root.

Follow-up results: 11 mission application tests passed; 26 passed including adjacent registration/activation regressions. SQL covers two-row batches for both importers across all six states, normalized emails, identity conflicts, and unrelated unique-constraint propagation. Five concurrency scenarios cover cooperative writers and each importer's INSERT fallback against an unlocked writer. Production build passed with the existing Brain tracing warning. Full tests after the original commits: 402 passed, 28 failed. The original 27 baseline failures remain; one additional existing branch-scope test forbids all ENTRY/migration changes (`console-user-management-v1.test.mjs`), which is incompatible with this authorized mission. Full lint retains five errors and one warning in customer pages and existing test files.

The DB runner creates/removes its own Supabase Postgres 17 container and fresh database; it accepts no remote DB URL. Fixtures contain exact read-only snapshots of both deployed queue writers and a minimal schema with explicit test stand-ins for authorization/audit/username helpers. Coverage includes house boundaries, email normalization, status reuse, Auth conflicts, SQL permissions, auditing, both bulk writers, and actual simultaneous database requests:

1. Two single-resident calls return the same queue_id with exactly one created row.
2. Canonical and legacy bulk writers both complete, with one live row and one row-level conflict.
3. Single-resident and canonical bulk requests cannot create duplicate live email rows.
4. Canonical bulk handles an unlocked writer's unique-index race and inserts the next row.
5. Legacy bulk handles the same race and inserts the next row.

Application tests exercise server actions and rendered forms with delivery mocks, including the unchanged canonical sender's PIN/link and invited metadata update. They do not send real email or complete real resident activation. Browser checks of the actual component passed on desktop and at 390px mobile width, with no captured browser errors; the temporary synthetic preview route was removed. Existing Community Registration code and its structural uniqueness are unchanged; the shared email index provides a final conflict guard for that writer too.

## Rudy's Manual QA

Use a disposable/dev environment with the reviewed migration applied, an authorized administrator, and existing Resend configuration. Vercel Preview remains read-only. Never disable Preview protection to test live operations. Do not manually apply this migration to production.

1. Open Minerva Field and select a test community.
2. Open an active house/unit, then choose Add resident.
3. Confirm Invite by email is selected and no username/password controls appear.
4. Enter a test resident name and a real test inbox you control. Optionally enter phone.
5. Continue and verify the confirmation identifies the intended unit/email without a password.
6. Send invitation. Confirm the button is disabled while pending.
7. Confirm Invitation sent appears only on accepted delivery, shows the destination email, and has no credentials copy/share controls.
8. Open View activation status and Activation Queue. Confirm the intended community/house, email method, invited state, and invite timestamp.
9. Confirm the email arrives with existing ENTRY branding and sender `ENTRY <no-reply@minervatechs.com>`.
10. Open its link and verify it uses the existing `/activate?pin=...` flow. Confirm PIN entry remains supported.
11. Complete activation with a password chosen by the resident.
12. Confirm the resident/account is associated with the original community and house and can sign in.
13. Repeat starting from `/field/entry/people/new` and community `/people/new`; both must lead to the same access-mode form.

Retry, conflicts, and failure:

1. Prepare another resident, then submit the same details again. Confirm the same queue row is reused and no automatic resend occurs.
2. Explicitly resend from Console Activation Queue. Confirm canonical PIN/email behavior and latest successful invite timestamp.
3. Try an existing Auth email in this community and another context. Confirm an explicit conflict and no new identity/queue row.
4. Try blank, whitespace, and invalid email. Confirm invitation cannot proceed.
5. In disposable/dev only, simulate email provider failure using test configuration. Confirm Resident prepared for activation, a retry warning, retained queue row, and no Invitation sent claim. Restore configuration and explicitly retry from Activation Queue.
6. Verify pending, PIN-generated, invited, and failed compatible rows are reused; activated conflicts; skipped history remains intact when superseded.
7. Verify foreign-community and inactive houses are rejected server-side. Verify Preview blocks both creation modes.

Password regression:

1. Select Create access now. Enter name, username or email, and an eight-character-or-longer password, or generate one.
2. Confirm and create the account. Verify the current immediate resident/house assignment.
3. Confirm login/password and Copy credentials remain available; check Share credentials on a browser supporting Web Share.
4. Refresh or leave and verify the password is not persisted in storage or the URL.

## Remaining Limits

Real inbox receipt and full activation require manual QA after reviewed migration deployment to a suitable dev environment. The unique index prevents duplicate queue identities, not exactly-once email delivery across independent manual resend operations. Existing PIN regeneration/resend behavior is retained. Large-table index deployment may briefly block queue writes; no online index rollout or production deployment is performed by this branch.
