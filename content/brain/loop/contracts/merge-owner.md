# Role Contract — Merge Owner

## Purpose

The human owner of the loop, currently Rudy. The merge-owner approves merges,
sets priority, resolves disagreements between roles, and owns the two approval
phrases. This role is documented as a contract like any other so its
boundaries are explicit — but unlike the model-fillable roles, it is held by a
human, because merge authority and final judgment are human responsibilities.

## May Read

- Everything: the repo, all PRs, all diffs, all CI, all reports.
- Git/GitHub as authority.

## May Write

- In principle anything (as repo owner), but by convention the merge-owner's
  writes are: approvals, priority calls, `ROADMAP.md` priority changes,
  moving briefs to `04_done/` after merge, and decision entries that resolve
  disagreements.
- The merge-owner should route implementation through missions, not hand-edits.

## Must Verify

Before merging, all of:

- CI checks are green on the PR.
- At least one review report says APPROVE (or the merge-owner has personally
  verified the work).
- The agent report's "verified" claims actually match the diff and checks.
- Nothing out of scope was touched.

## Must Never Do

- Merge a red or unreviewed PR.
- Let an agent merge without the explicit `MERGE APPROVED` phrase; merge
  approval is the merge-owner's alone even when an agent runs the command.
- Authorize a direct push to `master` without the separate `DIRECT PUSH
  APPROVED` phrase.
- Hand-edit an agent's diff to "help" — send it back with a review, or open a
  follow-up mission, instead.
- Become the courier: pasting one role's output into another role's chat
  instead of putting it in a repo file.
- Rely on chat memory when repo evidence is required — if it is not in the repo
  or on the PR, it did not happen.

## Required Handoff Artifact

Not a report — the merge-owner's artifacts are the **merge itself**, the brief
moved to `04_done/`, and any priority/decision recorded in the repo. After an
approved merge: squash-merge, pull `master`, delete the branch, move the brief
to done.

## Stop Conditions

The merge-owner is the terminal authority and does not "hand off" upward. It
pauses a merge when any Must-Verify item fails, and sends the PR back to the
implementer/reviewer roles.

## Evidence Rules

Holds every other role to the verified / inferred / unknown discipline in
[`../PROTOCOL.md`](../PROTOCOL.md), and applies it to its own decisions:
accept `unknown` honestly, never accept a fake-verified claim.

## Assignment Notes

This role is held by a human merge owner (currently Rudy). Unlike the
model-fillable roles, it is **not** assigned to a model. A future human could
hold it, and tooling may assist, but the `MERGE APPROVED` /
`DIRECT PUSH APPROVED` authority and the final merge judgment remain a human
responsibility. The two approval phrases are defined in
[`../PROTOCOL.md`](../PROTOCOL.md) and
[`../OPERATOR_GUIDE.md`](../OPERATOR_GUIDE.md).
