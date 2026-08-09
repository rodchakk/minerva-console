# ENTRY Community Registration - ENTRY-ONB-001 Closeout

## 1. Commit Baseline

- **Baseline commit:** `b81c3e85c2e36fb3003da76db7177d799089411e`
- **Short commit:** `b81c3e8`
- **Base before schema commit:** `60589e5a5538915dbb58a5c96ab501e1201c2bfe`
- **Branch:** `codex/entry-onb-001-schema`

## 2. Decision Audit Result

| File | Declared ID | Title | Status | Date |
| --- | --- | --- | --- | --- |
| `content/brain/decisions/INDEX.md` | none | Decisions - Index | n/a | n/a |
| `content/brain/decisions/dec-0005-non-mcb-product-captures.md` | `DEC-0005` | Non-MCB product knowledge captures are not Brain mission ledger entries | `approved` | `2026-07-02` |
| `content/brain/decisions/dec-0006-entry-first-door-patronato-package.md` | `DEC-0006` | ENTRY FIRST DOOR / Patronato Package v1 | `approved` | `2026-08-03` |
| `content/brain/decisions/dec-0007-entry-community-registration-foundation.md` | `DEC-0007` | ENTRY Community Registration Foundation | `approved` | `2026-08-05` |

Decision IDs are unique after this closeout diff. `DEC-0001` through `DEC-0004` remain documented in `content/brain/harness/03_DECISIONS.md`, not as long-form files under `content/brain/decisions/`.

`content/brain/registries/decisions.json` is valid JSON and now points:

- `DEC-0006` exclusively to `content/brain/decisions/dec-0006-entry-first-door-patronato-package.md`.
- `DEC-0007` exclusively to `content/brain/decisions/dec-0007-entry-community-registration-foundation.md`.

## 3. Conflicts Found

- `DEC-0006` was already assigned to `ENTRY FIRST DOOR / Patronato Package v1` in branch `codex/entry-first-door-patronato-package-v1`.
- The authentic Community Registration foundation decision existed as an untracked document with internal ID `DEC-0006`.
- `b81c3e8` contained schema/QA artifacts but did not contain the Phase 0 analysis, reconciliation, foundation decision or foundation contract.

## 4. Resolution Applied

- Preserved First Door / Patronato Package as `DEC-0006`.
- Assigned Community Registration Foundation to the next available ID, `DEC-0007`.
- Renamed the Community Registration foundation decision path to `content/brain/decisions/dec-0007-entry-community-registration-foundation.md`.
- Updated direct Community Registration references from `DEC-0006` / `dec-0006-entry-community-registration-foundation.md` to `DEC-0007` / `dec-0007-entry-community-registration-foundation.md`.
- Added the missing authentic foundation documents from the local original files available in `D:\Dev\minerva-console`.
- Restored the historical First Door decision and project document from `codex/entry-first-door-patronato-package-v1` to keep referenced context resolvable.
- Updated `content/brain/registries/decisions.json` with `DEC-0006` and `DEC-0007`.

## 5. Definitive Foundation Decision ID

`DEC-0007` is the definitive ID for ENTRY Community Registration Foundation.

`DEC-0006` remains the historical First Door / Patronato Package decision.

## 6. Files Renamed

- From authentic untracked source filename: `dec-0006-entry-community-registration-foundation.md`
- To closeout path: `content/brain/decisions/dec-0007-entry-community-registration-foundation.md`

No existing tracked decision file was deleted.

## 7. References Updated

- `content/brain/projects/entry-community-registration-foundation-contract.md`
- `content/brain/projects/entry-community-registration-schema-v1-qa.md`
- `content/brain/registries/decisions.json`
- New index and closeout documents reference `DEC-0007`.

Legitimate First Door references to `DEC-0006` remain unchanged.

## 8. Document Inventory

| Artifact | Path | Exists currently | Tracking state | Source original | Existed in `b81c3e8` | Added in closeout | References valid | SHA-256 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Initial analysis | `content/brain/harness/ENTRY_COMMUNITY_ONBOARDING_ANALYSIS.md` | yes | untracked | local original at `D:\Dev\minerva-console\content\brain\harness\ENTRY_COMMUNITY_ONBOARDING_ANALYSIS.md` | no | yes | yes | `94b25c6bdb1bede6ab44a318c30b14093d7bd6c1a3de4f67c9a66c8dad6be894` |
| Phase 0 reconciliation | `content/brain/projects/entry-community-onboarding-phase-0-reconciliation.md` | yes | untracked | local original at `D:\Dev\minerva-console\content\brain\projects\entry-community-onboarding-phase-0-reconciliation.md` | no | yes | yes | `859c37624253c0f8b0761ae1d6906e44ec33b25d7c6196959bf8744fdf129e06` |
| Foundation decision | `content/brain/decisions/dec-0007-entry-community-registration-foundation.md` | yes | untracked | local original `dec-0006-entry-community-registration-foundation.md`, renumbered | no | yes | yes | `953d29783b7cebd100fe9da2801d5d370965fff0b039477bb4c088e51aaff4e2` |
| Foundation contract | `content/brain/projects/entry-community-registration-foundation-contract.md` | yes | untracked | local original at `D:\Dev\minerva-console\content\brain\projects\entry-community-registration-foundation-contract.md`, references updated | no | yes | yes | `5962c941831c09abcb25eed201241eaad4993245134a692dbeb8c3c4ac4d3316` |
| Schema v1 | `content/brain/projects/entry-community-registration-schema-v1.md` | yes | tracked | commit `b81c3e8` | yes | no | yes | `b456066c08a3fc0152560086f97c91e23b5eaef27fc6c791e0ad8299d2b832dd` |
| Schema v1 QA | `content/brain/projects/entry-community-registration-schema-v1-qa.md` | yes | tracked modified | commit `b81c3e8`, references updated | yes | no | yes | `dbb25a03aa30ea035325f509267b767de405bf0aeab3205e259f9471564d268f` |
| Project index | `content/brain/projects/entry-community-registration-index.md` | yes | untracked | created in this closeout | no | yes | yes | `3a9db9bf3a81d3afe6970b7f684aadf5fbd00fdbb73d0407dd9b5b7924411bcc` |
| Closeout report | `content/brain/projects/entry-community-registration-entry-onb-001-closeout.md` | yes | untracked | created in this closeout | no | yes | yes | self-referential; final SHA-256 reported after last write |
| Migration v1 | `supabase/migrations/20260805000100_create_entry_community_registration_schema_v1.sql` | yes | tracked | commit `b81c3e8` | yes | no | yes | `7cdf57b4fc3425aaa9a14e8216e81e145aa7251a43f62383eee1a4eb083084b3` |
| Static validator | `scripts/entry-onb-001-validate-schema.mjs` | yes | tracked | commit `b81c3e8` | yes | no | yes | `11e2c738b8942104a8c0b75cba52f09e5bbfe419af24518ee7a772357ec43e6b` |
| Historical First Door decision | `content/brain/decisions/dec-0006-entry-first-door-patronato-package.md` | yes | untracked | `codex/entry-first-door-patronato-package-v1` blob `7caf4cea5cfa00367fb4e3f3bd6b1761a967dfda` | no | yes | yes | source-identical |
| Historical First Door project | `content/brain/projects/entry-first-door-patronato-package-v1.md` | yes | untracked | `codex/entry-first-door-patronato-package-v1` blob `22768f03de885b371a3b45cc1a865fbadce1dd74` | no | yes | yes | source-identical |

Files marked as not tracked in HEAD are present in this closeout working tree diff and should be committed after review.

## 8.1 Authenticity Evidence

| File | Source | Evidence | Result |
| --- | --- | --- | --- |
| `content/brain/decisions/dec-0006-entry-first-door-patronato-package.md` | `codex/entry-first-door-patronato-package-v1:content/brain/decisions/dec-0006-entry-first-door-patronato-package.md` | current Git blob `7caf4cea5cfa00367fb4e3f3bd6b1761a967dfda`; source blob `7caf4cea5cfa00367fb4e3f3bd6b1761a967dfda` | identical |
| `content/brain/projects/entry-first-door-patronato-package-v1.md` | `codex/entry-first-door-patronato-package-v1:content/brain/projects/entry-first-door-patronato-package-v1.md` | current Git blob `22768f03de885b371a3b45cc1a865fbadce1dd74`; source blob `22768f03de885b371a3b45cc1a865fbadce1dd74` | identical |
| `content/brain/harness/ENTRY_COMMUNITY_ONBOARDING_ANALYSIS.md` | local original in main worktree | source SHA-256 equals current SHA-256 `94b25c6bdb1bede6ab44a318c30b14093d7bd6c1a3de4f67c9a66c8dad6be894` | identical |
| `content/brain/projects/entry-community-onboarding-phase-0-reconciliation.md` | local original in main worktree | source SHA-256 equals current SHA-256 `859c37624253c0f8b0761ae1d6906e44ec33b25d7c6196959bf8744fdf129e06` | identical |
| `content/brain/projects/entry-community-registration-foundation-contract.md` | local original in main worktree | source and current differ only by direct `DEC-0006` -> `DEC-0007` and path updates to the renumbered foundation decision | authentic, reference-updated |
| `content/brain/decisions/dec-0007-entry-community-registration-foundation.md` | local original `dec-0006-entry-community-registration-foundation.md` in main worktree | source and current differ only on `**ID:**` from `DEC-0006` to `DEC-0007` | authentic, renumbered |

The FIRST DOOR documents are included because the restored initial analysis contains real references to `content/brain/decisions/dec-0006-entry-first-door-patronato-package.md` and `content/brain/projects/entry-first-door-patronato-package-v1.md`. If a later reviewer wants a narrower closeout, the minimum alternative is to keep only the `DEC-0006` decision file and remove the First Door project document while updating the analysis reference policy; that would be a separate documentary decision.

## 9. Tracking State

`b81c3e8` is intact for SQL, schema QA and validator artifacts. This closeout diff adds missing Brain documents and registry references but does not alter the SQL migration.

Exact added files:

- `content/brain/decisions/dec-0006-entry-first-door-patronato-package.md`
- `content/brain/decisions/dec-0007-entry-community-registration-foundation.md`
- `content/brain/harness/ENTRY_COMMUNITY_ONBOARDING_ANALYSIS.md`
- `content/brain/projects/entry-community-onboarding-phase-0-reconciliation.md`
- `content/brain/projects/entry-community-registration-entry-onb-001-closeout.md`
- `content/brain/projects/entry-community-registration-foundation-contract.md`
- `content/brain/projects/entry-community-registration-index.md`
- `content/brain/projects/entry-first-door-patronato-package-v1.md`

Exact modified files:

- `content/brain/projects/entry-community-registration-schema-v1-qa.md`
- `content/brain/registries/decisions.json`

Exact renamed files:

- Source filename `dec-0006-entry-community-registration-foundation.md` became closeout file `content/brain/decisions/dec-0007-entry-community-registration-foundation.md`.

## 10. Pending Gates

- Migration remains unapplied.
- Real PostgreSQL/Supabase engine validation remains mandatory before any apply.
- Catalog inspection remains pending.
- Negative constraint tests remain pending.
- RLS and grants verification remains pending.
- No push, PR or deployment has occurred in this closeout.

## 10.1 Validation Results

- `content/brain/registries/decisions.json`: valid JSON.
- Decision IDs under `content/brain/decisions`: no duplicates.
- Decision filename and internal ID: aligned for `DEC-0005`, `DEC-0006`, and `DEC-0007`.
- Global search for old Community Registration path: no active reference remains to the former Community Registration `DEC-0006` decision path.
- Global search for `DEC-0006`: valid only for FIRST DOOR, historical conflict explanation, or corrected-reference narrative.
- Global search for `DEC-0007`: valid for Community Registration.
- `git diff --check`: passed with LF/CRLF warnings only.
- SQL migration identical to `b81c3e8`: yes.
- Static validator identical to `b81c3e8`: yes.
- Working tree scope: Brain documentation and registry only.

## 11. Backend Readiness

- [x] No duplicated decision IDs remain in the closeout diff.
- [x] The foundation decision has a unique identity: `DEC-0007`.
- [x] Direct Community Registration references use the correct ID and path.
- [x] Foundational documents are present in the working tree and ready to version.
- [x] Baseline `b81c3e8` remains intact with respect to SQL.
- [x] The migration remains unapplied.
- [x] The pre-apply PostgreSQL gate remains documented.
- [x] No unrelated product, auth, SQL, Supabase, mobile, route or component changes were made.
- [x] `ENTRY-ONB-002` can be based on a single reproducible commit after this closeout diff is approved and committed.

## 12. Verdict

`READY TO COMMIT CLOSEOUT`

All decision IDs are unique, restored documents are authentic, references are valid, SQL/product files remain unchanged, and the closeout diff is delimited to Brain documentation and decision registry integrity.
