# Loop Protocol

The minimal, Git-backed, Markdown-first protocol for coordinating AI agents on Minerva Core Brain without making Rudy the message courier.

This is not an agent engine, scheduler, bot, or automation. It is a set of folders, files, and rules. Nothing here runs by itself. Humans and agents move files and open PRs; GitHub runs the checks.

## Purpose

Multiple agents (GPT, Claude, Codex, Gemini) work on the same repo at different times. Without a shared contract they talk through Rudy, and Rudy becomes the bottleneck. This loop replaces the courier with the repo: every brief, report, and review is a file on a branch, and every branch/diff/check/merge is on GitHub.

Core idea: **if it is not in the repo or on the PR, it did not happen.**

## Principles

1. **The repo is the relay.** Coordination happens through files in `content/brain/loop/**`, not through chat copy-paste.
2. **One writer per branch/mission.** A mission is owned by exactly one agent at a time. No two agents edit the same branch.
3. **Rudy is merge owner.** Only Rudy merges to `master`. Agents never merge.
4. **GitHub is authority.** Branch existence, diffs, CI results, and merge state are whatever GitHub says — not whatever a Markdown file claims.
5. **Markdown is the contract, not the truth.** Briefs and reports are auditable handoff. They record intent and claims; they do not override Git/CI evidence.

## Mission states (folder = status)

A mission brief is a single Markdown file. Its **status is the folder it lives in**. Moving a mission means moving (renaming) the file. There is no `QUEUE.json`; the folder is the queue.

```
content/brain/loop/missions/
├── 01_todo/      Planned. Brief written, not started.
├── 02_active/    One agent is working it on a branch.
├── 03_review/    PR open, awaiting review (Codex/Gemini) and Rudy.
├── 04_done/      Merged to master. Terminal.
└── 05_blocked/   Cannot proceed. Reason recorded in the brief.
```

### How a mission moves

1. **`01_todo` → `02_active`.** An agent picks up the brief, creates the branch named in it, and moves the brief file into `02_active/`. Only one agent does this per mission.
2. **`02_active` → `03_review`.** The owner agent opens a PR, writes a report under `reports/<agent>/`, and moves the brief into `03_review/`.
3. **`03_review` → `04_done`.** After review passes and Rudy squash-merges, the brief moves into `04_done/`.
4. **anything → `05_blocked`.** If the mission cannot proceed (missing evidence, dependency, ambiguity), move the brief into `05_blocked/` and record why in the brief. It returns to `01_todo` or `02_active` once unblocked.

Moves are done with `git mv` so history is preserved. A mission file is never in two folders at once.

## Evidence rules

Every claim in a report is tagged as one of three:

- **verified** — backed by direct, durable evidence you can point to: a commit hash, a merge-commit subject (`… (#12)`), a live branch ref, CI output, command output. Record the evidence.
- **inferred** — a reasonable conclusion that is **not** directly proven (e.g. "the branch was probably named like the others"). Allowed, but it must be labelled inferred. Never promote an inference to verified.
- **unknown** — no reliable current evidence exists. This is a valid, honest value. A local `origin/<branch>` remote-tracking ref alone is **not** proof (it can be stale and 404 on GitHub); when that is all you have, the answer is `unknown`.

Never write "verified" next to a field you cannot back with evidence. This is the same discipline the mission ledger already enforces in `content/brain/harness/04_WORKFLOW.md`.

## Branch / PR rules

- One branch per mission, named in the brief. Convention: `mcb-####-<slug>`.
- One agent writes per branch. If another agent must contribute, the first hands off via a report and stops.
- Work lands through a PR. No direct pushes to `master`.
- CI checks must be green before merge. Agents do not skip, disable, or weaken checks to get green.
- Rudy reviews and squash-merges. After merge: pull `master`, delete the branch.

## When an agent must stop

An agent stops and hands off (writes a report, leaves the mission where it is or moves it to `05_blocked`) when any of these is true:

- The next step would touch something outside the brief's **Files allowed** / **Scope**.
- It would need to modify a load-bearing file not named in the brief (`PROTOCOL.md`, `00_PROJECT_CHARTER.md`, guardrails, `.github/workflows/**`).
- A required fact cannot be verified and guessing would be needed to continue.
- CI is red and the fix is outside scope.
- The mission is ambiguous or depends on another unfinished mission.
- It is about to take an irreversible action (merge, delete, force-push). Those are Rudy's.

Stopping with an honest report is success, not failure. Inventing work or data is failure.

## What GitHub/Git own vs. what Markdown owns

| Question | Authority |
|---|---|
| Does this branch exist? | Git / GitHub |
| What changed? (diff) | Git / GitHub |
| Did CI pass? | GitHub checks |
| Is it merged? | GitHub PR / `master` |
| What was the commit/PR? | Git (`git log`, merge subject) |
| What was the *intent* and *plan*? | The mission brief (Markdown) |
| What did the agent *claim* it did? | The agent report (Markdown) |
| What did review *conclude*? | The review report (Markdown) |

Markdown records intent, claims, and conclusions for audit. When Markdown and Git disagree, **Git wins** and the Markdown is corrected.

## Delegated Git Ops

Agents may run the Git mechanics for a mission so Rudy stops being the manual operator. Rules:

- Agents may handle stage, commit, push, and PR creation for their mission.
- Each mission uses its own branch (`mcb-####-<slug>`). Never reuse one permanent branch for all work.
- Never use `git add .`. Stage by explicit paths only.
- Never stage or commit `.env.local`, `.claude/settings.local.json`, or any secret.
- Never merge without explicit approval. `MERGE APPROVED` authorizes an agent to complete the merge through the GitHub UI or `gh` when available. It does **not** authorize direct push to `master`.
- `DIRECT PUSH APPROVED` is the separate, explicit phrase required before any direct push to `master` (for example, a local squash merge pushed straight to master when `gh` is unavailable). Without it, prepare the PR and stop.
- Rudy remains the decision/merge-approval owner even when an agent runs the command.
- After an approved merge, the agent may pull `master` and delete the local and remote branch.
