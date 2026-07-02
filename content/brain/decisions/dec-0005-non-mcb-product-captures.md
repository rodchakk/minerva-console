# Decision — Non-MCB product knowledge captures are not Brain mission ledger entries

## Identity

- **ID:** `DEC-0005`
- **Title:** Non-MCB product knowledge captures are not Brain mission ledger entries
- **Status:** `approved`
- **Date:** 2026-07-02
- **Supersedes:** none
- **Tags:** brain, ledger, convention, ids
- **Related:** `MCB-0017` (and `MCB-0018`, once that mission registers
  itself in `missions.json` — see the registry entry for the current value)

## Context

`ENTRY-BRAIN-001` (PR #15, commit `98d1d34`) merged a large ENTRY
product-knowledge capture into `content/brain/projects/entry*.md`. Its PR
title and commit used a non-`MCB-` identifier. Brain's mission ledger
(`content/brain/registries/missions.json`) and guardrails CHECK 4
(`validateMissionEntry` in `scripts/brain-guardrails.mjs`) require every
ledger entry's `id` to start with `MCB-`. The MCB-0017 readiness audit flagged
this mismatch while reviewing mission-ledger drift, and MCB-0018 (this
decision's origin) needed a clear answer before deciding whether to register
`ENTRY-BRAIN-001` as a mission.

## Decision

`content/brain/registries/missions.json` tracks only `MCB-*` Brain-process
missions — the mission loop, ledger, guardrails, roadmap, and related
coordination work. Product knowledge-capture PRs that are not part of the
`MCB-` mission sequence, such as `ENTRY-BRAIN-001`, are **not** registered as
mission ledger entries. They remain fully documented through their own
artifacts: the captured knowledge docs themselves, plus the
`08_CHANGELOG.md` entry recording what shipped, in which PR, at which commit.
`ENTRY-BRAIN-001` is intentionally left out of `missions.json` — this is a
deliberate scoping decision, not unrepaired drift.

## Rationale

- Guardrails CHECK 4 enforces the `MCB-` prefix for every mission-ledger
  entry. Loosening that check to admit arbitrary IDs would weaken a
  guardrail — out of scope for a content-only ledger-repair mission, and not
  something to do casually per the v0 freeze.
- The mission ledger's purpose is tracking Brain's own operating process (the
  missions that build and maintain Brain itself), not every content
  contribution that flows through Brain. Product knowledge captures like the
  ENTRY docs are Brain *content*, already versioned and reviewable via
  Git/PR; they do not need a second, parallel process-tracking record to be
  legitimate knowledge.
- Introducing a permanent alias/exception ID scheme (for example treating
  `ENTRY-BRAIN-001` as `MCB-0016.5`) would retroactively rewrite a real,
  already-merged PR's identity in the ledger for cosmetic completeness, and
  would set a precedent of manufacturing MCB numbers for non-mission work —
  the opposite of the evidence discipline the loop is built on.
- Deferring is safer than forcing: a real convention change (for example an
  `MCB-` alias scheme, or a second product-capture registry) remains
  available as a future, explicit, named mission if the need recurs.

## Consequences

- `content/brain/registries/missions.json` stays `MCB-`-only; guardrails
  CHECK 4 is unchanged.
- Future non-`MCB` product knowledge-capture PRs follow the same pattern:
  documented in their target content folder and in `08_CHANGELOG.md`, but not
  added to the mission ledger, unless a future decision extends the ledger's
  ID convention.
- `content/brain/harness/04_WORKFLOW.md` gets a short clarifying note under
  Conventions so this is discoverable without re-deriving it from this
  decision doc.
