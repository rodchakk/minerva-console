# Minerva Security Watch — V1 (public-advisory radar)

Status: DRAFT, not running until release and activation steps below.

## Approved operator experience

Minerva Console → Observability / Security Watch. The user receives a notification, sees the *potential* issue, the technologies/products and responsible team, and clicks Copy finding or Copy full diagnosis to send a report to that team's AI.

There is NO Run scan button, no LLM API, no paid AI calls, no repository inspection, and no access to product code, servers or databases. Security Watch never patches, merges or deploys. Humans and project AIs verify actual exploitation prerequisites before changing anything.

## Coverage

- OSV.dev: querybatch by cataloged npm package + exact version, followed by per-advisory detail requests. These are **package-version matches, not deployed runtime attestations**.
- NVD updated CVE feed: targeted queries for catalog technologies, accepted only when structured CPE vendor/product identifiers match (currently Node.js and PostgreSQL). Version-range applicability still needs product-team verification. CVEs awaiting NVD enrichment without CPE identifiers may be missed. Incidental mentions of a technology in unrelated apps are rejected.
- Direct public vendor advisories for Supabase Storage, Auth and Realtime (GitHub Security Advisories): official notices, with hosted exposure **unverified**.
- Public recent published/updated notices (last 7 days); recent findings are retained in the UI for at most 60 days.
- In case a source fails, UI shows partial/failed coverage, not an "all clear".
- A match or high severity does not imply compromise.

The product technology inventory is a reviewed file at security-watch/catalog.json, with each product's owner/team, environment and npm versions, vendor keywords and optionally exact NVD CPE vendor/product identifiers. The initial entries are a manual starting snapshot, NOT proof of what is running in production. To add a new product (such as Brother's), ask that project's AI for an inventory with no secrets, then submit a PR updating its catalog entry. No system connection is required.

## Storage and isolation

We reuse Minerva Console's existing server-side Upstash Redis instead of migrating production Supabase tables. Namespaced keys begin with minerva:security-watch:v1:. Stored records are sanitized public notices, no user/customer information. No changes to ENTRY billing, Auth, RLS, OCR, jobs or data.

Only the existing Console owner can open the /security-watch page. A dedicated, bounded /api/security-watch/ingest endpoint authenticates the scheduled scanner using a short-lived signed GitHub OIDC token, pinned to the exact repository and workflow. It does not fetch arbitrary user URLs or execute commands.

## Deployment and activation

1. Review catalog versions/teams, tests and preview. The project owner remains responsible for confirming a technology profile.
2. Vercel production must have a verified Resend sender/recipient: SECURITY_WATCH_ALERT_FROM and SECURITY_WATCH_ALERT_TO. Existing RESEND_API_KEY and Upstash env variables are reused.
3. Merge only after security review. The GitHub Actions workflow runs on changes to the scanner/catalog on master, then at approximately 06:17 / 18:17 Honduras. Only master may ingest.
4. The runner obtains a short-lived GitHub-issued OIDC JWT, with the dedicated audience minerva-security-watch-ingest-v1. The server verifies the signature from GitHub's fixed JWKS, issuer, exact repository ID, branch, workflow and run ID. No shared token or GitHub Actions secret is needed.
5. Check GitHub Actions run result and Minerva Console's timestamp/source statuses after the initial scan. Confirm mail delivery on a legitimate high-severity match. A scanner feed failure must not be presented as a clean bill of health.

The /api/security-watch/ingest route is excluded from cookie login middleware only on that exact path. Its independent GitHub identity check remains mandatory; attempts without valid OIDC are rejected before storage access. No product data is fetched.

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
