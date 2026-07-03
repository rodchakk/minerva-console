# Agent Report Quality Checklist

Use this checklist to evaluate whether an **Agent Report** (produced by the implementation agent/model) meets loop quality standards before moving to the review stage.

## 1. Metadata & Scope
- [ ] **Assigned Role & Model:** The report declares the assigned role (e.g. `implementer`) and the model used (e.g., `Gemini`, `Claude`).
- [ ] **Branch & PR:** The report specifies the feature branch name and PR number (or "unknown" if the PR is not yet created).
- [ ] **Files Changed:** The report lists every file modified, created, or deleted.

## 2. Implementation Summary
- [ ] **Work Summary:** The report explains the work accomplished and the technical approach taken.
- [ ] **Decisions/Rationale:** Any non-obvious design decisions, workarounds, or architecture selections are documented.

## 3. Verification & Evidence
- [ ] **Checks Executed:** The report lists the exact commands run to verify correctness (e.g., `npm run brain:guardrails`, `npx tsc --noEmit`).
- [ ] **Test Results:** The results of the commands are documented (e.g., green/passed).
- [ ] **Evidence Claims:** The report states what was verified and lists the exact commit SHA or PR state where the evidence was captured.

## 4. Boundaries & Future Planning
- [ ] **Scope Boundaries Respected:** The agent explicitly confirms that no out-of-scope files were modified and freeze boundaries were respected.
- [ ] **Known Limitations:** Any limitations, technical debt, or temporary workarounds are documented.
- [ ] **Next Recommended Action:** The agent recommends the next logical mission or follow-up item.
