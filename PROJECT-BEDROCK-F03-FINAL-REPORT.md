# Project BedRock F03 — Final Engineering Report

## Outcome

F03 is confirmed, designed, and implemented in an isolated branch. The new v2
flow eliminates candidate-keyed rate limits and PIN-bearing audit identifiers
for migrated consumers, replaces PIN-only database scans with an indexed opaque
handle, removes plaintext-at-rest storage for v2 credentials, and preserves
atomic single consumption.

The implementation is intentionally additive. Public v1 activation remains a
known P0 residual until installed mobile clients have migrated. No production
change, notification, credential operation, merge, or deployment occurred.

## Evidence

- Branch base: `b17d9a3eb6bf7038914b965e86d4e6cc24a8efd8`
- PostgreSQL: synthetic fixture, migration, behavior suite, and two-session
  concurrency passed on Supabase PostgreSQL 17.6 and the exact official
  `postgres:17` CI service image.
- Focused Node security/activation tests: passed.
- TypeScript: passed.
- Focused ESLint: passed.
- Next production build: passed.
- Deno worker check: passed.
- Global suite: 730 tests, 685 passed, 45 failed. The current master baseline
  has 44 inherited failures; the sole additional failure is an unrelated
  branch-isolation meta-test that rejects any ENTRY/migration change.

## Security verdict

Ready for Draft security review, not merge or deploy. Required release gates
are documented in `docs/bedrock-f03-activation-pin-hardening.md`, especially
the coordinated mobile transition and later v1 permission removal.
