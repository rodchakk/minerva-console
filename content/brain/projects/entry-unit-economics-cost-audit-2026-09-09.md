# ENTRY Unit Economics — Cost Audit Baseline

**Date:** 2026-09-09  
**Status:** Evidence baseline captured; real economics data intentionally not yet entered into Seshat pending completion of the Unit Economics foundation.  
**Purpose:** Preserve the verified/observed cost inventory gathered for ENTRY so the audit does not need to be reconstructed again.

## Core rule

Do not collapse Minerva, ENTRY and a client into one economic layer.

Target hierarchy:

**Minerva Technologies → Product (ENTRY) → Client (e.g. Residencial Andalucía)**

A cost may belong to Minerva company-wide, to ENTRY as a product, or directly to a client. Preserve the original vendor/company cost and any allocation separately.

Unknown is not zero. A cost may be known to exist but still have an unknown amount, unit rate, allocation, or production quantity.

---

## First real ENTRY economics case

**Client:** Residencial Andalucía  
**Product:** ENTRY  
**Annual contract value:** HNL 35,000  
**Commercial structure:** annual commitment, billed monthly  
**Expected go-live:** 2026-10-01  
**Known unit count:** 98  

The annual contract value is authoritative; do not rebuild it from rounded monthly invoices.

---

# A. ENTRY product/shared technical costs

## 1. Supabase Pro — ENTRY

- Classification: ENTRY shared product / technical platform
- Current historical plan during audit: Free
- Planned production plan from 2026-10-01: Pro
- Planned base cost: **USD 25.00/month**
- Pro is advertised as "from USD 25/month"; overages/tax are separate if they ever occur.
- Current observed usage while on Free:
  - Egress: 0.32 GB of 5 GB
  - Cached egress: 0.00 GB
  - Database size: 183.41 MB
  - Storage average: 0.11 GB
  - MAU: 31
  - Edge Function invocations: 14,733 in the observed billing period
  - Realtime messages: 630
  - Realtime concurrent peak: 5
- Important follow-up: ~700–800 Edge Function invocations/day appeared unusually steady; forensic investigation was opened separately. Do not treat that usage as normal until explained.

**Economic baseline:** USD 25/month starting 2026-10-01, subject to later real billing evidence.

## 2. Apple Developer Program

- Classification: ENTRY shared product / mobile distribution
- Annual fee: **USD 99/year**
- Renewal date observed: 2027-04-24
- Monthly normalized cost: **USD 8.25/month**
- Current allocation assumption: attributable to ENTRY while ENTRY is the Minerva iOS product using the account; allocation may change if additional Minerva iOS products use it later.

## 3. Vercel

- Classification: ENTRY shared platform / hosting
- Current cost: **USD 0/month**
- User expects a paid plan later, but no future price is included until actually activated.

## 4. Upstash Redis

- Resource observed: `minerva-entry-cr-preview-rl`
- Classification: ENTRY shared/usage-based infrastructure
- Observed Sep 2026 usage: approximately 1.7K commands, ~113 B average storage
- Current billed cost: **USD 0/month**
- Follow-up eventually: confirm production ENTRY uses this same resource and there is no separate hidden paid Redis instance.

## 5. Resend

- Classification: ENTRY/shared messaging infrastructure
- Plan: Free
- Current cost: **USD 0/month**
- Free transactional quota: 3,000 emails/month
- Observed transactional usage: 25 / 3,000
- Optional pay-as-you-go pricing exists but is not a current cost.

## 6. Expo / EAS

- Classification: ENTRY shared mobile delivery/release infrastructure
- Plan: Free
- Current cost: **USD 0/month**
- Observed usage included examples such as builds within free quota, 2 MAU for EAS Update, and very small bandwidth.
- Build activity is shared release/development work, not a per-community multiplier.

## 7. GitHub / GitHub Actions

- Classification: ENTRY shared development/CI platform
- GitHub plan: GitHub Free
- Copilot plan observed: Copilot Free
- Current billed amount: **USD 0/month**
- Gross usage values may appear in GitHub usage screens, but observed billed amount remained USD 0.
- Do not include Copilot Free as cost-to-serve.

## 8. Firebase / Google Cloud — ENTRY Push

- Firebase project: `Entry-push`
- Firebase plan: Spark / no-cost
- Google Cloud project had no billing account linked during audit
- Classification: ENTRY shared push infrastructure
- Current cost: **USD 0/month**

## 9. Cloudflare platform service

- `minervatechs.com` shown on Cloudflare Free plan
- Classification: shared platform service / DNS-CDN-proxy
- Current platform service cost: **USD 0/month**
- Domain registration is a separate company-level cost below.

## 10. Google Play Developer Registration

- Receipt date: 2026-04-26
- Fee: **USD 25 one-time**
- Tax observed: USD 0
- Classification: historical one-time product/platform setup
- Recurring cost: **USD 0/month**
- Do not automatically charge this historical setup fee to Andalucía merely because Andalucía is the first client.

---

# B. ENTRY variable / marginal usage costs

## Gemini API — vehicle plate OCR

ENTRY uses Gemini in the vehicle check-in flow to process vehicle images and extract the plate into text.

- Classification: ENTRY usage-based / variable technical cost
- Economic behavior: usage, not fixed platform minimum
- Conceptual unit: vehicle OCR/image processing request
- Historical prepaid top-up observed: **USD 10**
- Current prepaid balance observed: approximately **USD 9.97**
- Auto-reload: OFF
- Monthly spend cap observed: **USD 2.00**
- Observed spend so far: extremely small (around cents)
- Model observed: Gemini 2.5 Flash

**Important:** Do not enter Gemini as permanently USD 0. The correct economics is eventually:

`cost per OCR × OCR requests attributable to client = client usage cost`

Until trustworthy production quantity/unit-cost evidence exists, preserve this as usage cost with incomplete/unknown monetary detail rather than inventing a value.

Future observability should ideally expose at least:
- vehicle OCR requests
- successes
- failures
- model/usage information when available
- estimated/actual cost

---

# C. Minerva company-shared costs identified

These are real Minerva expenses but must **not** automatically be charged 100% to ENTRY.

## 1. ChatGPT Plus

- Classification: Minerva company shared / AI-development-operations tooling
- Cost: **USD 20.00/month**
- Used across ENTRY and other Minerva work (e.g. Seshat, Minerva Console/internal work).
- Requires explicit company → product allocation before becoming ENTRY fully-loaded cost.

## 2. Namecheap Private Email — Expand

- Domain/subscription context: `minervatechs.com`
- Current plan: Expand Email
- Order date: 2026-08-26
- Annual charge: **USD 41.88/year**
- 3 mailboxes included
- Monthly normalized cost: **USD 3.49/month**
- Renewal/expiration observed: 2027-08-26
- Classification: Minerva company shared overhead
- Historical Launch renewal figure of USD 14.88 is superseded; do not count both.

## 3. `minervatechs.com` domain — Cloudflare Registrar

- Invoice date: 2026-04-25
- Service period: 2026-04-25 through 2027-04-24
- Annual cost: **USD 10.46/year**
- Monthly normalized cost: approximately **USD 0.87/month**
- Classification: Minerva company shared overhead
- Cloudflare Free platform service and registrar fee are distinct.
- Namecheap is being used for email; current domain registration evidence points to Cloudflare Registrar.

### Known Minerva shared overhead subtotal

- ChatGPT: USD 20.00/month
- Private Email: USD 3.49/month
- Domain: USD 0.87/month

**Total identified Minerva shared overhead: USD 24.36/month**

This subtotal is NOT the same as ENTRY cost. It must be allocated intentionally across Minerva products/work.

---

# D. Confirmed ENTRY fixed technical baseline

Current confirmed/planned recurring ENTRY technical platform baseline:

- Supabase Pro: USD 25.00/month
- Apple Developer normalized: USD 8.25/month
- Vercel: USD 0
- Upstash: USD 0
- Resend: USD 0
- Expo/EAS: USD 0
- GitHub: USD 0
- Firebase/GCP: USD 0
- Cloudflare platform: USD 0

**ENTRY technical minimum currently identified: USD 33.25/month**

This excludes:
- Minerva company-shared allocation
- Gemini usage
- human labor
- onboarding/support
- any future real overages

If all identified Minerva shared overhead were incorrectly charged 100% to ENTRY, the arithmetic would be USD 57.61/month (33.25 + 24.36), but **USD 57.61 is not an approved ENTRY cost figure**. It is only a warning/example showing why company/product allocation is necessary.

---

# E. Human/labor economics — to begin measuring

Human time is expected to be economically important and must be measured separately from infrastructure.

Required categories agreed for the foundation:

1. **Onboarding / implementation**
   - Client-direct
   - Examples: configuration, data loading, training, launch support, field testing
   - Normally first-year/one-time delivery economics

2. **Support**
   - Client-direct operational
   - Examples: guard issues, patronato calls, login problems, client-specific troubleshooting

3. **Product maintenance**
   - ENTRY shared operational
   - Examples: logs, releases, security maintenance, general bug maintenance

4. **Product development / R&D**
   - Track time at ENTRY/product level
   - Do not automatically charge all R&D to Andalucía simply because it is currently the first client

Also preserve work mode where useful:
- ONSITE
- REMOTE

Hours may be known before an internal hourly economic rate is known.

**Known hours + unknown rate must not become zero labor cost.**

Minerva Field is planned to act as the simple field-time capture instrument; time will initially be transferred manually into Seshat.

---

# F. Unit Economics foundation decisions before data entry

No real cost rows are to be entered yet until the backend foundation supports the required model cleanly.

Foundation requirements agreed:

1. **Minerva → Product → Client** hierarchy and allocations.
2. Preserve original company cost separately from product allocation.
3. Manual percentage/weight allocation is sufficient for this version.
4. Human/labor time economics with optional/effective-dated rates.
5. Distinguish **MODELED / EXPECTED** economics from **ACTUAL / OBSERVED** economics.
6. Respect effective dates and historical periods; a future vendor price change must not rewrite past economics.
7. Missing required evidence/rate/FX must remain incomplete, never silently zero.
8. Zero-cost dependencies are still valid records because they are real dependencies with quotas and may become paid later.
9. R&D is tracked but excluded from client cost-to-serve unless explicitly classified to participate.
10. No automatic vendor/telemetry sync is required for the foundation; manual trustworthy input comes first.

---

# G. Deliberately deferred

Do not expand the current foundation into:

- automatic Supabase/Gemini/Vercel billing ingestion
- bank sync
- tax engine
- payroll
- CRM
- project management
- complex allocation algorithms
- automated pricing engine
- forecasting/ML pricing

Seshat's current target is financial/economic clarity for Minerva/ENTRY, not a general ERP.

---

# Resume point for next session

Tomorrow, continue from this baseline instead of rebuilding the vendor list.

Primary next work:

1. Review the backend implementation produced for the Seshat Unit Economics foundation.
2. Confirm it can represent every item in this cost audit without distortion.
3. Build/verify the minimum frontend necessary to enter company costs, product costs, allocations, labor/work actuals, expected usage and actual observations.
4. Only after that begin entering real ENTRY/Andalucía economics data.
5. Start measuring real Andalucía onboarding/support time immediately once Field timer/manual process is available.

This document is the canonical cost-audit baseline from the 2026-09-08/09 economics session until superseded by newer evidence.
