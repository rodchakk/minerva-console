# Runbook — Close a Mission

What must happen after a PR merges, so a mission actually lands in the
ledger instead of drifting. This runbook exists because MCB-0016 and
MCB-0017 both merged to master without a ledger entry — nobody ran a
checklist, so the gap wasn't caught until the MCB-0017 audit went looking for
it, and MCB-0018 had to repair it after the fact. Follow this list every
time, for every mission, so the next repair mission is unnecessary.

This is not automation. Nothing here runs by itself; an agent or Rudy walks
through it by hand after a merge.

## Checklist

1. **Confirm the PR number and squash commit from GitHub/Git — not memory.**
   Run `git log -1 --format="%H %s" <ref>` on the merged commit, or read the
   PR page. The commit hash only exists after the squash-merge completes; do
   not guess it, and do not reuse a feature-branch commit hash in its place.
2. **Confirm the merged state from GitHub/Git.** `git log --oneline master`
   (or `gh pr view <n>`) is authority. A mission is "merged" only when Git
   says so — not when a brief or report claims it.
3. **Update or create the mission doc** at `content/brain/missions/mcb-####.md`
   following the existing format (Status, Summary, Scope, Files / Areas,
   Branch / PR / Commit with an evidence note, Validation, Outcome, Next
   Steps).
4. **Update `content/brain/registries/missions.json`** with the matching
   entry: `id`, `title`, `type: "mission"`, `status`, `summary`, `created`,
   `updated` (date-only `YYYY-MM-DD`), `tags`, `related`, `path`, `agent`,
   `branch`, `pr`, `commit`, `phase`. Every field CHECK 4 requires
   (`scripts/brain-guardrails.mjs`) must be present and a string.
5. **Move the loop brief to `04_done/`** with `git mv`, if this mission used
   a `loop/missions/**` brief. Not every mission does (ledger-repair and
   audit missions historically have not); skip this step if no brief exists.
6. **Update `content/brain/harness/08_CHANGELOG.md`** with a dated entry
   (most recent first) summarizing what shipped, in plain language, without
   inventing detail beyond what the diff supports.
7. **Run `npm run brain:guardrails`.** Must pass. CHECK 7 will fail if a
   mission doc exists without a matching registry entry — treat that failure
   as the drift signal it is, not noise to route around.
8. **Run `npm run brain:check-relations`.** Must report no broken relations.
9. **Never invent branch or agent values.** Record `branch` only from a
   durable source: a live GitHub branch ref, reliable PR metadata, or another
   authoritative record. Record `agent` only from a commit
   `Co-authored-by` / `Co-Authored-By` trailer (or `human` when clearly
   hand-authored).
10. **Do not treat a stale local branch ref as verified.** A local
    `origin/<branch>` remote-tracking ref can outlive the branch's deletion
    on GitHub. Run `git fetch --prune` and check the branch against GitHub
    (`gh api repos/<owner>/<repo>/branches` or the branch page) before
    recording a branch name. If the branch is gone or unconfirmed, record
    `branch: "unknown"` and say why in the mission doc's evidence note — see
    `content/brain/harness/04_WORKFLOW.md` § Unverifiable mission fields.
11. **Never use `git add .`.** Stage the exact files this step touches.
12. **Never merge, and never push directly to master, without explicit
    approval.** `MERGE APPROVED` authorizes a squash-merge via GitHub UI or
    `gh` only. `DIRECT PUSH APPROVED` is the separate phrase required before
    any direct push to master. Closing a mission (this checklist) happens
    *after* one of those approvals has already been exercised — it is
    bookkeeping, not a merge action.

## Self-registration during the mission (preferred over deferring)

Historically, a mission was almost always registered in the ledger by a
*later* mission (MCB-0009 registered MCB-0007's status fix; MCB-0011
registered MCB-0009; MCB-0012 registered MCB-0010/0011; MCB-0015 registered
MCB-0012/0013/0014; MCB-0016 registered MCB-0015; MCB-0018 registered
MCB-0016/0017). That chain works only if the next mission remembers — and
twice it didn't.

Prefer registering a mission as part of its own PR instead of deferring:

- The **branch name** is verifiable immediately, because it is the live
  branch the mission is committed to — no reconstruction needed later.
- The **PR number** is knowable as soon as the PR is opened. Open the PR
  first (even before the final commit), then push a small follow-up commit
  into the same PR adding the ledger entry with the real PR number. Multiple
  commits in one PR are normal here — MCB-0016 did exactly this with a
  `finalize loop dry run state` follow-up commit, later squashed together.
- The **commit hash** genuinely cannot be known before a squash-merge
  creates it (the hash depends on content that would include the hash — a
  circular impossibility). Register with `commit: "unknown"` and
  `status: "in_progress"`, then fix both fields in a tiny follow-up edit
  once Rudy merges. That edit is a five-minute chore; an unregistered
  mission that nobody notices for weeks is not.

## Why this matters

`content/brain/loop/PROTOCOL.md` states the core rule: *if it is not in the
repo or on the PR, it did not happen.* A merged mission with no ledger entry
violates that rule from the other direction — it happened, but the repo
doesn't know it. This runbook is the mechanical antidote.
