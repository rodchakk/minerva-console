# ENTRY-ONB-007 — Post-Merge Closeout

**Mission:** `ENTRY-ONB-007`

**Status:** CLOSED — merged to `master` and production web deployment verified.

## Merge

PR #39 (`ENTRY: add community registration campaign launch UI`) was squash-merged to `master`.

Final `master` commit:

`f3c95a784f5356427fba1797ea851a095897b88d`

## Production Web Deployment

Vercel automatically deployed the squash commit to the Minerva Console Production target.

Post-merge verification confirmed:

- deployment state `READY`;
- `console.minervatechs.com` serving the merged build;
- no new Vercel runtime errors observed in the post-deploy smoke window.

## Supabase Wiring / Migration State

Production Minerva Console is configured against Supabase project `gate-project-dev` (`ytzvislhvrcdtkbtpbmu`). The deployed client bundle was inspected only to confirm the project URL/reference; no secrets are recorded here.

The Community Registration migration chain is present on that project through:

`20260817014957_create_entry_community_registration_launch_ui_hardening_v1`

Therefore no additional ONB-007 database migration was required after the PR merge.

Supabase project `seshat` (`vfvbvywvmoevyucqgtos`) is a separate project and does not contain the ENTRY `communities` or `community_registration_*` tables. It was not modified.

## Runtime Evidence Retained

The pre-merge PR Preview walkthrough remains the authoritative functional proof for ONB-007:

- internal campaign launch succeeded;
- campaign access capability was shown only on immediate success;
- reload did not redisplay plaintext capability material;
- replacement-link rotation revoked the old capability and left exactly one active replacement;
- public access and Casa 1 unit lookup succeeded;
- Casa 1 completed one end-to-end public submission with two resident records;
- Console progress updated from `0 / 5` to `1 / 5` submitted units.

The test data remains confined to the dedicated `Residencial Prueba CR` community on `gate-project-dev`.

## Safety / Non-Scope

- No migration or data write was applied to `seshat`.
- No additional Community Registration migration was applied after merge.
- No Production Upstash credential or rate-limit secret value was changed or rotated.
- ENTRY mobile was not modified.
- Existing Supabase advisor debt and existing Brain/full-lint debt remain separate follow-up work and were not changed by this closeout.

## Final Verdict

`ENTRY-ONB-007` is complete and closed.
