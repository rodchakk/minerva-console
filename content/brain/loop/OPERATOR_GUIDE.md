# Operator Guide (for Rudy)

How to run the loop in minutes a day. Your job is three moves: **approve a brief, merge a green PR, move the mission to done.** Everything else is the agents' and the repo's job.

## Start a mission

1. Make sure a brief exists in `missions/01_todo/`. If not, ask GPT (Orchestrator) to write one from `templates/mission-brief.md`, then drop it in `01_todo/`.
2. Pick the next brief. Confirm its **Scope**, **Files allowed**, and **Owner agent** make sense.
3. Hand the brief to that agent (see the prompt below).

## The prompt to give an agent

Keep it the same every time so behaviour is predictable:

```
You are <Claude|Codex|Gemini>, working the Minerva Core Brain loop.
Read content/brain/loop/PROTOCOL.md and ROLES.md first.
Your mission brief is content/brain/loop/missions/01_todo/<file>.md.
Create the branch named in the brief, do ONLY what the brief allows,
run the required checks, write a report under reports/<agent>/, open a PR,
and move the brief to 03_review/. Do NOT merge. Stop and report if you hit
a scope boundary or cannot verify a required fact.
```

## Where reports go

- Implementation handoffs: `reports/<agent>/<mission>-<agent>.md` (from `templates/agent-report.md`).
- Reviews: `reports/<reviewer>/<mission>-review.md` (from `templates/review-report.md`).
- You read the report instead of asking the agent to re-explain in chat.

## When to ask for review

- After the owner agent opens the PR and moves the brief to `03_review/`.
- Ask Codex (CI/QA) and/or Gemini (adversarial) to review the PR and write a review report.
- A review with verdict **REQUEST CHANGES** goes back to the owner agent; the brief stays in `03_review/` (or moves to `05_blocked/` if it can't proceed).

## When to merge

Merge only when **all** are true:

- CI checks are green on the PR.
- At least one review report says **APPROVE** (or you have personally verified it).
- The agent report's "verified" claims actually match the diff and checks.
- Nothing out of scope was touched.

Then: squash-merge → `git pull` on master → delete the branch → `git mv` the brief into `04_done/`.

## What you must NOT do

- Do not merge red or unreviewed PRs.
- Do not let an agent merge without your explicit `MERGE APPROVED` — merge approval is yours alone, even though an agent may run the merge command once you give it.
- Do not hand-edit the diff to "help" an agent; send it back with a review instead.
- Do not become the courier: if you find yourself pasting one agent's output into another agent's chat, stop and put it in a report file instead.
- Do not accept "verified" claims without evidence. Unknown is fine; fake-verified is not.

## Basic flow

```
brief in 01_todo
   → agent creates branch, moves brief to 02_active
   → agent works, opens PR, writes report, moves brief to 03_review
   → reviewer writes review report (APPROVE / REQUEST CHANGES)
   → Rudy: squash merge → pull master → delete branch
   → Rudy: move brief to 04_done
```

Blocked at any point → move brief to `05_blocked/`, record why, unblock later.

## Delegated Git Ops

You no longer have to drive Git by hand. An agent can do the mechanics; you keep the decisions.

- Agents may handle stage, commit, push, and PR for their mission.
- Each mission stays on its own branch (`mcb-####-<slug>`). No single permanent branch for everything.
- Agents never use `git add .` — staging is by explicit paths.
- Agents never touch `.env.local`, `.claude/settings.local.json`, or secrets.
- Agents never merge without your explicit `MERGE APPROVED`. That phrase authorizes the merge via GitHub UI or `gh` only — it does **not** authorize a direct push to `master`.
- `DIRECT PUSH APPROVED` is the separate phrase you give before any direct push to `master` (e.g. a local squash merge pushed straight to master when `gh` is unavailable). Until one of these is given, the agent opens the PR and stops.
- You stay the merge-approval owner even when the agent runs the command.
- After you approve and the merge lands, the agent may pull `master` and delete the local/remote branch.
