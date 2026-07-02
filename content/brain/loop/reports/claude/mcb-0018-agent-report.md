# Agent Report

**Mission:** `MCB-0018`
**Agent:** Claude (Implementer)
**Branch:** `mcb-0018-ledger-repair-registration-runbook`
**Commit:** pending — this mission is registering itself as part of its own
PR (see `content/brain/loop/runbooks/close-a-mission.md` § Self-registration
during the mission); the squash commit hash is unknowable before merge and
will be filled into `missions.json` afterward.

## Changed files

- created:
  - `content/brain/missions/mcb-0016.md`
  - `content/brain/missions/mcb-0017.md`
  - `content/brain/missions/mcb-0018.md`
  - `content/brain/decisions/dec-0005-non-mcb-product-captures.md`
  - `content/brain/loop/runbooks/close-a-mission.md`
  - `content/brain/loop/roadmaps/ROADMAP.md`
  - `content/brain/loop/reports/claude/mcb-0018-agent-report.md` (this file)
- modified:
  - `content/brain/registries/missions.json` (added MCB-0016, MCB-0017, MCB-0018)
  - `content/brain/registries/decisions.json` (added DEC-0005)
  - `content/brain/harness/04_WORKFLOW.md` (added "Mission ledger scope" note)
  - `content/brain/harness/08_CHANGELOG.md` (added MCB-0018 entry)

## Ledger repairs made

- **MCB-0016** registered: PR `#14`, commit `61f4cac`, agent `claude`,
  branch `unknown`. Verified from the merge commit subject
  `MCB-0016 — Brain v0 closeout (#14)` and the squash commit's
  `Co-Authored-By: Claude Opus 4.8` trailer.
- **MCB-0017** registered: PR `#16`, commit `f1cbd2d`, agent `fable`, branch
  `unknown`. Verified from the merge commit subject
  `MCB-0017 brain agent operating layer readiness audit (#16)` and the
  squash commit's `Co-authored-by: Claude Fable 5` trailer.
- For both, `branch: "unknown"` is verified, not a gap: `git fetch --prune`
  removed the stale local `origin/mcb-0016-brain-v0-closeout` and
  `origin/mcb-0017-brain-agent-operating-layer-audit` remote-tracking refs,
  and `gh api repos/rodchakk/minerva-console/branches` returned no match for
  either name — the branches are confirmed deleted from GitHub, not merely
  unchecked.

## ENTRY-BRAIN-001 convention decision

Chose the recommended default: **did not register `ENTRY-BRAIN-001` as a
mission**. Added `DEC-0005` (registry entry + `content/brain/decisions/
dec-0005-non-mcb-product-captures.md`) recording that
`content/brain/registries/missions.json` tracks only `MCB-*` Brain-process
missions; non-`MCB` product knowledge captures are documented via their
content docs and the changelog instead. Added a short "Mission ledger scope"
note to `04_WORKFLOW.md` pointing at `DEC-0005`. This was a deliberate scope
decision, not an oversight — guardrails CHECK 4 already enforces the `MCB-`
prefix, and loosening it or minting a synthetic `MCB-0016.5`-style alias for
an already-merged, differently-purposed PR was judged riskier than leaving a
documented gap.

## Roadmap added

`content/brain/loop/roadmaps/ROADMAP.md`, seeded from the MCB-0017 audit:
MCB-0018 (in_progress, this mission) → MCB-0019 Agent Contracts v1 → MCB-0020
Scoped Context Pack Exporter → MCB-0021 Loop State Snapshot CLI → MCB-0022
Loop Guardrails & Review Evals → MCB-0023 Local Triage Pilot (design-gated).
Each entry has status, purpose, owner, risk, dependencies, and acceptance
criteria.

## Runbook added

`content/brain/loop/runbooks/close-a-mission.md`: the exact post-merge
checklist (confirm PR/commit from Git, confirm merge state, update/create
mission doc, update the ledger, move the loop brief if one exists, update
the changelog, run both guardrail scripts, never invent branch/agent values,
never trust a stale local branch ref, never `git add .`, never merge or
direct-push without the explicit approval phrase), plus a documented
self-registration pattern (register during the mission's own PR — verified
branch, PR number known once opened, `commit: "unknown"` until merge) to
replace the "always defer to the next mission" pattern that let MCB-0016 and
MCB-0017 go unregistered.

## Commands run

- `git log -1 --format="%H%n%s%n%b" 61f4cac` → confirmed PR #14 / commit
  `61f4cac` / `Co-Authored-By: Claude Opus 4.8`.
- `git log -1 --format="%H%n%s%n%b" f1cbd2d` → confirmed PR #16 / commit
  `f1cbd2d` / `Co-authored-by: Claude Fable 5`.
- `git fetch origin --prune` → removed stale local refs for both deleted
  feature branches (and several older ones).
- `gh api repos/rodchakk/minerva-console/branches --paginate --jq
  ".[].name"` filtered for both branch names → no match (confirmed deleted
  on GitHub, not just locally stale).
- `npm run brain:guardrails` → pass (run twice: once before this mission's
  own registry entry existed, once after).
- `npm run brain:check-relations` → pass (same two-pass run).
- `npx tsc --noEmit` → pass, no output.
- `gh pr create ...` → opened PR `#17`, used to fill in this mission's own
  `pr` field in `missions.json` and `mcb-0018.md`.

## Results

All three required checks pass against the final diff:

- `npm run brain:guardrails` — **PASS**
- `npm run brain:check-relations` — **PASS**
- `npx tsc --noEmit` — **PASS** (no output)

No check was weakened, skipped, or disabled to get to green.

## Risks

- MCB-0018's own ledger entry carries `commit: "unknown"` and
  `status: "in_progress"` until Rudy merges this PR. This is a small, bounded,
  documented gap (fixed by a five-minute follow-up edit per the new runbook),
  not silent drift — but it does mean `missions.json` briefly shows one
  in-progress entry rather than a fully closed ledger.
- `DEC-0005` is a scoping decision, not a permanent prohibition. If product
  knowledge captures become frequent enough to want ledger visibility, a
  future named mission should revisit the ID convention rather than working
  around it ad hoc.

## Blockers

None.

## Next agent request

Rudy: review this PR, then give `MERGE APPROVED` to merge via `gh`. After
merge, per `close-a-mission.md`, a short follow-up edit to `missions.json`
should flip MCB-0018's `status` to `completed` and fill in the real squash
commit hash — happy to do that as a one-line fast-follow once the merge
commit exists.

Recommended next mission: **MCB-0019 — Agent Contracts v1** (per
`loop/roadmaps/ROADMAP.md` and the MCB-0017 audit's own recommendation
chain).
