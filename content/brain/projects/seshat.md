# Seshat

Financial operating system for Minerva and service-based businesses.

## Overview

Seshat is a fintech product under the Minerva umbrella. Its near-term internal role is to become Minerva's management-accounting and financial-intelligence system: a simple system that evolves with the real business instead of trying to become a generic accounting suite all at once.

Seshat should help Minerva answer, with explicit separation between company, product, and client economics:

- How much cash does Minerva have and how is it moving?
- How much revenue, cost, contribution, and margin does each product generate?
- How profitable is each client or engagement?
- Which costs belong to a product, a specific client, Minerva Corporate, or shared infrastructure?
- How much of Minerva's corporate overhead is being financed by product contribution without falsely classifying corporate expenses as direct product costs?

Seshat is an internal management system first. It must not be assumed to replace statutory, tax, or legally required accounting in Honduras.

## Operating Model Decision — 2026-08-20

Minerva is the company. ENTRY, Seshat, and future offerings are products / business units inside Minerva.

The approved internal accounting model is:

1. Minerva receives customer revenue and pays providers.
2. Every revenue and cost record keeps its economic owner instead of being collapsed into one bucket.
3. Product-direct costs remain attached to the product that causes them.
4. Client-specific costs remain attached to the client / engagement that causes them.
5. Minerva Corporate costs remain corporate and are not artificially charged to ENTRY merely because ENTRY currently generates the cash used to pay them.
6. Shared infrastructure remains shared until a stable allocation rule is justified.
7. Positive contribution from ENTRY or another product is available to finance Minerva Corporate, reserves, reinvestment, or other products.
8. Product P&L and consolidated Minerva P&L must remain separately visible.
9. Broad corporate-overhead allocation across products is intentionally deferred until multiple products have enough real operating activity to justify a stable policy.

Initial business-unit / cost-center model:

- `MIN-CORP` — Minerva Corporate / general overhead.
- `ENTRY` — ENTRY product economics.
- `SESHAT` — Seshat product economics.
- Future Minerva products receive their own business-unit code.

Clients sit under the relevant product economics. Example: `ENTRY -> Residencial Andalucía`.

## Current Foundation — Reviewed 2026-08-20

Repository reviewed: `rodchakk/seshat`, branch `main`.

Current Seshat foundation already supports important pieces of the intended model:

- clients;
- services;
- client services with weekly / monthly / quarterly / yearly / one-time frequency;
- invoices, invoice items, payment status, amount paid, and balance due;
- expenses and expense categories;
- recurring-cost normalization through monthly equivalents;
- expense allocations to clients using fixed monthly amount, percentage, or equal split;
- operational client profitability views containing monthly revenue, allocated monthly expenses, estimated monthly profit, and margin;
- dashboard summaries for revenue, expenses, profit, and recent months.

Live Seshat Supabase inspection on 2026-08-20 showed the principal operational tables effectively empty, making this the preferred window to evolve the financial model before real Minerva financial history is entered.

## Minimum Evolution Before Real Minerva Financial Use

These changes are approved as the minimum future adaptation set. They are **not an active implementation mission as of 2026-08-20**.

### P0 — Required foundation

#### 1. Business units / cost centers

Add structural support for product and corporate ownership of financial records rather than relying only on expense categories or client assignment.

Minimum units:

- `MIN-CORP`
- `ENTRY`
- `SESHAT`

The model must support records such as:

- Supabase for ENTRY -> `ENTRY`
- Gemini plate-recognition consumption -> `ENTRY`
- Minerva domain / corporate website / corporate email / accountant -> `MIN-CORP`
- gasoline or onboarding material for Residencial Andalucía -> `ENTRY` + Andalucía client context

#### 2. Base currency + multi-currency accounting

Minerva's management-reporting base currency should be HNL unless a later business decision changes it.

Seshat must preserve:

- original amount;
- original currency;
- FX rate used for the financial event / reporting conversion;
- converted base-currency amount.

USD and HNL values must never be summed directly without conversion. Historical reports must retain the FX basis used at the time rather than silently changing when today's rate changes.

#### 3. Cash transactions vs economic commitments

Separate actual money movement from normalized recurring economics.

Examples:

- Apple Developer: cash may leave once as `$99`, while management economics can recognize `$8.25/month` equivalent.
- Gemini prepaid balance: a `$10` top-up is a cash outflow / prepaid balance, while only consumed API usage is an ENTRY expense.
- A client may pay an annual contract up front while management reporting recognizes a monthly revenue equivalent for unit economics.

Seshat should therefore distinguish at least:

- cash transactions / receipts / payments;
- recurring or contractual cost/revenue commitments;
- economic recognition / monthly equivalents;
- prepaid balances where materially useful.

#### 4. Correct client profitability

Client profitability must include both:

- direct client costs; and
- allocated shared costs.

A direct expense assigned to a client must not disappear merely because the operational profitability view is based on `expense_allocations`, and the same cost must never be counted twice.

### P1 — Operational intelligence

#### 5. Work logs / labor costing

Support work logs with at least:

- date;
- business unit / product;
- optional client;
- activity;
- hours;
- internal cost per hour;
- calculated labor cost.

This is required to measure implementation and support economics for service-heavy deployments such as ENTRY communities.

#### 6. Product and consolidated reporting

Provide clear views for:

- Client P&L / contribution.
- Product / Business Unit P&L.
- Consolidated Minerva P&L.
- Minerva cash flow.

ENTRY contribution and Minerva corporate profit must remain distinguishable. ENTRY may economically finance Minerva's corporate overhead without reclassifying that overhead as an ENTRY direct cost.

### P2 — Later refinement

Potential later additions include:

- explicit prepaid-asset balances and depletion tracking;
- budgets / forecasts;
- more advanced overhead-allocation rules;
- automated provider imports / reconciliation;
- additional financial intelligence once real usage proves it useful.

These are not prerequisites for the first minimal financial operating model unless real operations expose a need.

## ENTRY / Andalucía Use Case

The current ENTRY commercial work is the motivating real-world test case for Seshat's next evolution.

Seshat should eventually be able to represent a community such as Residencial Andalucía with:

- customer revenue and payment cadence;
- ENTRY business-unit ownership;
- recurring ENTRY platform costs;
- variable API consumption such as Gemini plate recognition;
- implementation labor;
- travel and onboarding materials;
- direct client costs;
- allocated shared ENTRY costs where appropriate;
- client contribution and margin;
- ENTRY-wide contribution after combining all communities;
- Minerva Corporate overhead kept separately;
- consolidated Minerva profitability and cash.

The goal is not to hard-code Andalucía-specific logic. Andalucía is the first concrete operating scenario that defines what the generic Minerva service-business model must be able to measure.

## Infrastructure Decision — 2026-09-03

### Current approved state

Seshat remains on its **existing Supabase project** and should stay on Free infrastructure while its internal scale and criticality permit.

- Supabase project: `seshat`.
- Project ref: `vfvbvywvmoevyucqgtos`.
- Supabase organization: `Minerva Internal`.
- Organization plan: Free.
- State at the time of capture: paused.
- Brain does not store Seshat operational financial data.
- Brain may store Seshat product, accounting-model, and architecture decisions.

On 2026-09-03 the existing Seshat Supabase project was transferred from the `Minerva Technologies` organization to the separate `Minerva Internal` organization. This was an organizational/billing separation only: no replacement database was created and no data migration was performed.

The transfer was visually confirmed in the Supabase dashboard on 2026-09-04: `seshat` appears under `Minerva Internal` on the Free plan. The original `Minerva Technologies` organization is therefore reserved for ENTRY's commercial Supabase path rather than carrying Seshat into the same paid billing boundary.

ENTRY remains independently hosted in `gate-project-dev` (`ytzvislhvrcdtkbtpbmu`) under the original `Minerva Technologies` Supabase organization. This separation allows ENTRY to move to Supabase Pro for commercial operation without automatically moving Seshat into the same paid organization/cost model.

### Approved infrastructure rules

- Keep Seshat on Supabase Free while its current internal scale and criticality permit.
- Do not build local storage, SQLite, PC-based synchronization, or an offline replacement merely to avoid paid Supabase infrastructure.
- Do not self-host Supabase for the current Seshat stage.
- Do not create a replacement Supabase project for Seshat.
- Do not modify Seshat application code, `.env`, Project URL, keys, Auth, Storage, or schema merely because the existing project changed organizations.
- When Seshat work resumes, unpause the project and QA login, existing financial information, clients, expenses/financial records, a safe test write, and any Storage asset used by the application before making corrective configuration changes.
- If Seshat later becomes commercially operated, materially multi-user, higher scale, or service-critical, reevaluate infrastructure through a separate reviewed decision/mission based on actual requirements at that time.
- There is **no currently approved migration away from Supabase** and no replacement provider is preselected.

This decision supersedes the 2026-08-20 directional note that treated a future migration away from Supabase as already approved. The current architecture is intentionally simpler: retain the existing Supabase project, separate billing, and revisit only when real scale or criticality creates a concrete need.

Long-form decision: `DEC-0009` — `content/brain/decisions/dec-0009-seshat-infrastructure-supabase-billing-separation.md`.

## Operating Stage Update — 2026-09-04

Seshat's immediate product priority is deliberately narrow: support Minerva's own day-to-day financial operation for the two current internal operators and improve from real use before expanding outward.

Approved operating posture:

1. **Internal operation first.** Build around the financial workflows Minerva is actually using now rather than designing prematurely for residential communities, patronatos, or a broad external customer base.
2. **Real use drives scope.** New fields, reports, automations, and accounting concepts should be justified by actual Minerva usage or a concrete operating gap.
3. **Growth is incremental.** Seshat may later expand to more Minerva users, client-facing workflows, community financial operations, or a commercial product, but those stages should emerge from the proven internal system rather than being treated as current requirements.
4. **Keep infrastructure proportional.** The independent Free Supabase project remains appropriate for the current two-operator stage. Paid or different infrastructure should be triggered by real scale, storage, uptime, compliance, or commercial requirements rather than anticipation alone.
5. **Do not confuse future scenarios with current scope.** Residential/community receipt workflows are useful for capacity planning, but they are not an active Seshat implementation requirement as of this update.

## Future Receipt / Image Storage Planning Note — 2026-09-04

Future Seshat workflows may attach photographic evidence such as receipts, invoices, payment proofs, or expense documents. If Seshat later serves communities or patronatos, image assets could become the dominant storage cost even when the relational database remains small.

This is a **planning direction, not an active implementation mission**.

When receipt-image upload is implemented, prefer client-side optimization before upload so Seshat does not store full-resolution phone originals by default. The working engineering target should preserve document legibility while minimizing storage:

- resize large images to roughly 1600–1800 px on the long side where appropriate;
- remove unnecessary metadata such as EXIF;
- encode as WebP or JPEG at a quality level that preserves small text and transaction references;
- target approximately **150–250 KB per typical receipt image**;
- treat roughly **300–350 KB** as a practical upper target for difficult images rather than a hard universal limit;
- do not keep both the original and optimized copy unless a later legal/compliance requirement explicitly justifies it;
- validate compression against real receipts before freezing quality settings.

These values are capacity-planning targets, not measured guarantees. A future implementation mission should test them on real Seshat receipt samples.

Illustrative future capacity scenario only: two communities of about 200 homes each, one resident receipt per home per month, plus about 50 administrative receipt images per community per month, would produce roughly 6,000 images/year. At an average of 200 KB per optimized image, that is about 1.2 GB/year of new image storage. This is **not a forecast for current Seshat usage**; the current internal two-operator stage should generate materially less storage.

If actual commercial usage approaches Free-plan storage or operational limits, reevaluate Storage and the Supabase plan/provider based on measured volume at that time rather than preemptively changing architecture now.

## Product Evolution Principle

Seshat should evolve incrementally around Minerva's real operating needs.

Do not add accounting complexity merely because traditional finance software contains it. Prefer the smallest model that accurately answers the business questions Minerva currently needs, then extend it when real clients, products, cash movement, or reporting requirements expose a concrete gap.

The target is a specialist financial operating system for the kind of product + service business Minerva is becoming: simple to operate, but capable of producing trustworthy unit economics, client profitability, product contribution, company-level profitability, and cash visibility.

## Boundaries

- Seshat operational financial records remain outside Brain.
- Brain stores decisions, architecture, operating model, and future direction only.
- Financial figures used for planning must distinguish verified actuals from estimates and scenarios.
- Seshat management accounting must not be presented as statutory or tax accounting without separate professional validation.

## Status

- **Status:** Approved
- **Stage:** Active internal product / incremental evolution from real Minerva use
- **Current users:** two internal operators
- **Current infrastructure:** Existing Supabase project `seshat` (`vfvbvywvmoevyucqgtos`) in `Minerva Internal` Free; transfer confirmed 2026-09-04; paused at capture
- **Immediate product focus:** Minerva's own financial operation first; expand only from proven internal workflows
- **Financial operating model adaptation:** Approved direction, not yet scheduled
- **Future receipt/image optimization:** Planning direction only; not an active implementation mission
- **Future backend migration:** Not currently planned or approved; reevaluate only if scale/criticality creates a concrete need
