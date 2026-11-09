# Minerva Security Watch — V1 (public-advisory radar)

Status: DRAFT, not running until release and activation steps below.

## Approved operator experience

Minerva Console → Observability / Security Watch. The user receives a notification, sees the *potential* issue, the technologies/products and responsible team, and clicks Copy finding or Copy full diagnosis to send a report to that team's AI.

There is NO Run scan button, no LLM API, no paid AI calls, no repository inspection, and no access to product code, servers or databases. Security Watch never patches, merges or deploys. Humans and project AIs verify actual exploitation prerequisites before changing anything.

## Coverage

- OSV.dev: querybatch by cataloged npm package + exact version, followed by per-advisory detail requests. These are **package-version matches, not deployed runtime attestations**.
- NVD CVE publication feed: vendor keyword mentions (Node.js, PostgreSQL, Supabase, etc.). These are **keyword mentions only**, frequently needing manual elimination of false positives. A provider advisory not included in NVD may be missed.
- Direct public vendor advisories for Supabase Storage, Auth and Realtime (GitHub Security Advisories): official notices, with hosted exposure **unverified**.
- Public recent published/updated notices (last 7 days); recent findings are retained in the UI for at most 60 days.
- In case a source fails, UI shows partial/failed coverage, not an "all clear".
- A match or high severity does not imply compromise.

The product technology inventory is a reviewed file at security-watch/catalog.json, with each product's owner/team, environment and npm versions or vendor keywords. The initial entries are a manual starting snapshot, NOT proof of what is running in production. To add a new product (such as Brother's), ask that project's AI for an inventory with no secrets, then submit a PR updating its catalog entry. No system connection is required.

## Storage and isolation

We reuse Minerva Console's existing server-side Upstash Redis instead of migrating production Supabase tables. Namespaced keys begin with minerva:security-watch:v1:. Stored records are sanitized public notices, no user/customer information. No changes to ENTRY billing, Auth, RLS, OCR, jobs or data.

Only the existing Console owner can open the /security-watch page. A dedicated, bounded /api/security-watch/ingest endpoint accepts data from the scheduled scanner authenticated by SECURITY_WATCH_INGEST_TOKEN. It does not fetch arbitrary user URLs or execute commands.

## Activation (requires the administrator)

1. Validate catalog versions/owners and merge only after CI + UI review.
2. Generate a new, unique random token with at least 32 characters. Do not paste it in chat, code or logs.
3. Store the token as SECURITY_WATCH_INGEST_TOKEN in **Vercel production** and as a GitHub Actions repository **secret** of the same name.
4. Create a GitHub Actions repository **variable** SECURITY_WATCH_INGEST_URL pointing to https://console.minervatechs.com/api/security-watch/ingest once the live hostname is checked.
5. Configure Vercel production SECURITY_WATCH_ALERT_FROM (a verified Resend sender) and SECURITY_WATCH_ALERT_TO (intended recipients), retaining the existing RESEND_API_KEY. Preview mail is deliberately disabled.
6. Add GitHub Actions repository variable SECURITY_WATCH_ENABLED=true only after all previous values are installed and the production endpoint is ready. Until then, the scheduled job is skipped and UI remains activation pending.
7. Redeploy after adding Vercel variables. Trigger the GitHub workflow once manually from the default branch for a monitored smoke run. Confirm true provider status and verified mail delivery before considering it operational.

With SECURITY_WATCH_ENABLED=true, a missing secret makes the scheduled job fail clearly; disabled setup does not run and the UI cannot show a false healthy status.

## Schedule, alerts and costs

GitHub Actions cron '17 0,12 * * *' in UTC is approximately 18:17 and 06:17 in Honduras. GitHub schedules can be delayed or skipped, so this is NOT a strict service-level guarantee.

New HIGH/CRITICAL matches generate one consolidated Resend email; advisory+technology fingerprints suppress repeat emails. Lower severities remain visible without sending repetitive notifications. Failed or unconfigured mail is displayed on the dashboard.

Expected extra cost is zero while the existing GitHub Actions, Upstash, Resend and Vercel plans remain within their included usage. This is not a financial guarantee.

## Release / safety checks

- node --test tests/security-watch-scanner.test.mjs
- npm ci; npx tsc --noEmit; npm run build
- Validate unauthenticated POST/GET, oversized payload, malicious source fields, owner access, DNS/provider errors, rate limits, duplicated scans and no live email in Preview.
- Inspect UI at mobile and desktop widths.
- Do not merge or deploy until the relevant checks pass and the owner approves.

## Deliberate limitations

This is a RADAR, not a vulnerability scanner or proof of security. It does not independently certify patched runtime versions, fetch provider-only bulletins not present in these public sources/vendor bulletins, or know that an AI has applied a fix. Later we may add first-party security feeds and an independent stale-heartbeat alert.
