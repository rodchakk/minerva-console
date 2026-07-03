# Review Report Quality Checklist

Use this checklist to evaluate whether a **Review Report** or **Adversarial Audit** meets loop quality standards before a pull request is merged.

## 1. Identity & Context
- [ ] **Reviewer Identity & Assigned Role:** The report clearly declares the reviewer's identity (e.g. model name) and assigned role (e.g., `reviewer-ci` or `adversarial-auditor`).
- [ ] **Target PR/Mission:** The report explicitly names the mission ID (e.g., `MCB-####`) and links/references the PR or branch reviewed.

## 2. Verification Rigor
- [ ] **Files Inspected:** The report lists the specific files and directories that the reviewer inspected.
- [ ] **Checks Verified:** The reviewer lists the verification commands executed (e.g. test suites, linter runs) and their output status.
- [ ] **Evidence Quality:** The reviewer evaluates whether the implementation agent's claims are backed by solid, checkable evidence, or if they rely on assumptions.

## 3. Scope & Boundary Analysis
- [ ] **Brief Alignment:** The reviewer compares the implemented changes against the approved mission brief and checks for any deviations.
- [ ] **Scope Creep Inspection:** The reviewer confirms that no out-of-scope files or components (such as ENTRY runtime, Seshat, DB, or external integrations in v0) were modified or added.

## 4. Findings & Recommendations
- [ ] **Explicit Recommendation:** The report ends with a clear recommendation: `MERGE APPROVED`, `HOLD`, or `REQUEST CHANGES`.
- [ ] **Known Unknowns:** The reviewer documents any gaps, unverified claims, or assumptions that remain unresolved.
- [ ] **Next Steps:** The reviewer notes any recommended follow-up missions or corrections.
