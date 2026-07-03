# Runbook: Review Evaluations

This runbook outlines how human and model reviewers apply the evaluation checklists to ensure high-quality reviews and prevent drift in the Minerva Core Brain loop.

## Overview

Quality guardrails are only as strong as the reviews that enforce them. To prevent superficial "looks good to me" approvals, all review stages (PR reviews, adversarial audits) must be measured against explicit criteria before being merged into `master`.

## Step-by-Step Review Workflow

### 1. Retrieve the Brief and Implementation
The reviewer reads:
- The mission brief (e.g., `content/brain/loop/missions/02_active/mcb-####.md`).
- The agent's handoff report (e.g., `content/brain/loop/reports/<model>/mcb-####-agent-report.md`).
- The branch diff in Git/GitHub.

### 2. Verify Handoff Quality
Use the [Agent Report Checklist](../evals/agent-report-checklist.md) to evaluate the implementation agent's handoff report.
- Did they cover all required fields?
- Are their claims of passing tests actually supported by logs/output?
- Did they touch any file outside of the allowed list?

### 3. Perform Review & Audit
The reviewer runs the required checks locally:
```bash
npm run brain:loop-state
node scripts/brain-loop-state.mjs --check
npm run brain:export-context
npm run brain:export-packs
npm run brain:guardrails
npm run brain:check-relations
npx tsc --noEmit
```
Verify that the implementation does not introduce any hidden dependencies or freeze violations.

### 4. Fill the Review Quality Checklist
Complete the [Review Report Checklist](../evals/review-report-checklist.md).
- Embed this completed checklist directly in your review report.
- Sign off the report with an explicit directive: `MERGE APPROVED`, `HOLD`, or `REQUEST CHANGES`.

## Quality Gates

- **No checklist, no merge:** Pull requests must not be merged if they lack a matching review report containing a completed checklist.
- **Strict boundary enforcement:** Any deviation from the mission brief or modification of out-of-scope files must lead to an immediate `HOLD` or `REQUEST CHANGES`.
