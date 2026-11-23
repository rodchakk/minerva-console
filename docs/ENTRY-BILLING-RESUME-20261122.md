# ENTRY Billing — recovery and application integration gate (2026-11-22)

**Status: LOCAL RECOVERY REQUIRED. Production / merge / deploy: NO-GO.**

This note resumes ENTRY Billing from the latest *local* evidence, without assuming that any Billing implementation has been promoted. ENTRY owns its billing ledger; Seshat is not a runtime dependency.

## Verified historical implementation and gaps

- 005A/005B previously reported 25 financial entities and SQL tests passing with synthetic PostgreSQL 17 data. The seven 005B entities were `fee_rules`, `unit_terms`, `submissions`, `evidence`, `cash_handovers`, `custody_discrepancies`, `opening_batches`.
- 005B's implemented contracts covered monthly-fee preview/generation, resident transfer submissions, bank verification, cash-session handover, and opening-balance batches. Upload authorization returned `NOT_CONFIGURED`; full Storage HTTP evidence was **not tested**.
- 004 R5 only confirmed an unauthenticated Entry-Web `/login` 200 and `/financial` redirect on a **local** server. Authenticated SSR, financial Server Actions, receipt submission, L19/L20 and rollback compatibility were **not passed**.
- The later `/admin/billing` interface at `127.0.0.1:3014` was local-only; do not present localhost as a public preview.
- Original 004 and 005 worktrees held **uncommitted** work; their contents cannot be reconstructed from the default GitHub branches. Preserve before building on top.

## Step 0: preserve and inventory the actual source

On the **original Windows computer** with those worktrees, from a local `rodchakk/minerva-console` checkout:

```powershell
node scripts/entry-billing-worktree-inventory.mjs .
```

The script reads only Git metadata and the existence of known Billing files. It does not read secrets, connect to Supabase, or modify source/database. Its output includes local paths; **keep output private**, not in a public PR. Inspect each original worktree with `git status` and `git diff --stat`. Review all untracked files for secrets before any commit; keep local backups. Do not `git reset --hard`, `git clean`, force-checkout, rebase, or blindly `git add -A`.

Known branches: `codex/entry-billing-004-legacy-financial-hardening` and `codex/entry-billing-005a-ledger-foundation`. Search for migration `20261106120000_entry_billing_005b_operations.sql`, test fixtures and reports. The 005C lab was called `entry-billing-005c-lab`, loopback 57321/57322; don't restart, delete, or use its data without inspecting the current state.

## Step 1: resolve financial identity before enabling actions

`financial_principals.status='active'` and `verified_person_key` require a trusted issuer and documented independent identity verification. **Do not invent a UUID, infer person verification from Auth email, or auto-activate access.** Keep access denied until the verification authority, per-community membership, scoped capabilities, approval separation, and audit evidence are established. Operational SUPERADMIN privileges must not grant financial privileges by default.

Authorized collectors may record cash; only administrators reconcile. Transfers do not reduce receivables until verified. Keep history immutable, tenant boundaries enforced, and fees in integer cents.

## Step 2: isolated technical closure

1. Recover reviewed worktree code into a Draft PR; do not recreate missing SQL from narrative reports.
2. Rebuild a separate synthetic PostgreSQL/Supabase Auth/PostgREST/Storage lab; rerun SQL cases, double-entry balance, idempotency, FIFO, concurrent writes, role revocation and cross-community negatives (a generic SQL error is not a security PASS).
3. Connect native ENTRY `/admin/billing` to the exact verified RPCs. Exercise monthly-fee preview → explicit confirmation → per-unit history → authorized cash/transfer → verification → balance, plus receipt storage and audit.
4. Verify genuine SSR login, cookies, server actions, refused actions and evidence-upload lifecycle; repeat with two isolated communities and negative roles.
5. Verify patched current Next.js dependencies, build, typecheck and test; provide a **real authenticated Vercel Preview URL** for operator inspection. No mocks described as financial backend.
6. Keep billing disabled, recurrence disabled and no scheduler by default. Do not touch Andalucía, operational Access/QR/guard/mobile, production data or money without explicit release approval.

## Release conditions

Recovered code reviewable in a Draft PR, deterministic test evidence, authenticated preview, identity governance resolved, evidence Storage proven, and L19/L20 passed. Until then: **NO-GO**.
