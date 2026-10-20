# QA: approved registration contact correction (ENTRY)

## Scope
Minerva Console > ENTRY > Community Registration > Household review.
This fix is intentionally limited to **submitted** or **Patronato-confirmed** households that have not been prepared in Activation Queue.

## Release gates (DEV first; then production with explicit approval)
1. Apply `20261020170000_entry_approved_registration_contact_edit.sql` to DEV.
2. Deploy the matching Console branch to DEV/preview and check all cases below against disposable QA records.
3. Review the SQL migration and the audit entries; obtain approval before any production database migration.
4. For production, coordinate the database migration and Console release so the UI is not exposed before the RPC supports approved-household corrections. Do not alter existing live registration records in this release.

## Positive cases
- In a `submitted` household, Edit resident permits name, email and phone; the household remains `submitted`.
- In a Patronato-approved `confirmed` household with two residents sharing one email, each resident has Edit; the name is read-only and email/phone can be changed.
- Change only one resident's email to a separately confirmed email, save, and refresh: the shared-email warning disappears. The unit and submission remain `confirmed`; their Patronato confirmation timestamps and approval history are unchanged.
- Confirm that no user, PIN, invite or Activation Queue row is created by the edit.
- Verify one `community_registration_events` `internal_correction` event exists for a real edit, with actor type `superadmin`, resident ID, unit status and changed field names only. No names, emails, phones or raw tokens in metadata.
- Save an unchanged record: no additional audit event.
- Perform the usual `confirmed` -> Activation Queue handoff once contacts are distinct and verified.

## Negative/security cases
- Try changing the approved name via a direct RPC invocation: `ENTRY_CR_APPROVED_IDENTITY_LOCKED`; no database change.
- Try editing a `processed` unit or a resident already linked to Activation Queue: reject; use Activation Queue's own contact editor for queued residents.
- Try editing a `reviewed`, `edit_enabled`, `needs_correction`, `merged` or stale submission: reject.
- Try a mismatched resident/submission/unit ID or a non-superadmin actor: reject.
- Reject invalid email/phone formats, including excessively long values.
- Verify the resident quick edit keeps existing same-household and identity warnings; this fix does **not** merge accounts or validate that an address belongs to the resident.
- Exercise concurrent conversion and contact edit in DEV: the campaign -> unit -> submission -> resident locking must not deadlock, and an edit must never change an already-queued identity.

## Rollback
- UI rollback: revert the three review UI/query files and server action change.
- Database: don't blindly replay the old SQL or mutate approved records. Use a reviewed forward migration to restore submitted-only policy if necessary, preserving audit history. Existing contact corrections are historical facts and must not be rolled back automatically.

## Test status
Code review/source invariants only. Full Next.js build, DEV database migration, end-to-end tests, and production checks are pending.
