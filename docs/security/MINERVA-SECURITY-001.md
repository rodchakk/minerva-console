# MINERVA-SECURITY-001

Assessment date: October 22, 2026, America/Guatemala. Repository: `rodchakk/minerva-console`; production: `console.minervatechs.com`.

## Release recommendation

**GO for the expedited dependency-only hotfix, subject to explicit owner approval and acceptance of the baseline failures/residual risks below.** No new full-suite failures were found. This is not an all-green verification; required failing CI checks must not be bypassed automatically. Vercel's managed Node patch rollout is tracked separately and does not alone block the Next.js hotfix. No merge or production deployment has been performed.

## Scope and baseline

Separate clone and branch `codex/minerva-security-001`, based on `master` at `f2fec2c6f7f80978b284221b404bc65078f897dc`, matching the inspected production deployment. The original working tree's unfinished registration changes were untouched. No other repository was altered. Read `AGENTS.md`, `CLAUDE.md`, README, release strategy, applicable release checklist and version-matched Next.js upgrade/Proxy documentation before implementation. The existing web-push migration/cron rollout checklist is not invoked by this dependency patch.

No application behavior, UI, authorization rule, RLS policy or database migration is changed in the final patch. React and Supabase SDK versions/lock entries are unchanged. Temporary Preview-only server logging, if present during investigation, is removed before handoff.

## Findings and remediation

| Package | Installed baseline | Patched lockfile | Reason |
| --- | --- | --- | --- |
| next / eslint-config-next | 16.2.4 | 16.4.1 | Framework October security fixes and matching lint integration |
| sharp | 0.34.5 | 0.35.5 | Patched image codecs, including librsvg CVE-2026-96889 |
| xlsx (SheetJS CE) | 0.18.5 | 0.20.3 | Patched parser from the official distribution, vendored locally |
| postcss | 8.4.31 nested / 8.5.13 | 8.5.23 | CSS source-map disclosure fixes; Next's required version |
| @babel/core / generator | 7.29.0 / 7.29.1 | 7.29.6 / 7.29.6 | Core advisory and required generator dependency |
| brace-expansion | 1.1.14 / 5.0.5 | 1.1.21 / 5.0.12 | Fixed versions within existing major lines |
| browserslist | 4.28.2 | 4.28.7 | First fixed version; only required browser-data dependencies follow |
| js-yaml | 4.1.1 | 4.3.2 | Covers returned parser/prototype/DoS advisories |
| baseline-browser-mapping | 2.10.25 | 2.11.0 | First fixed version for invalid-input termination |
| nanoid / source-map-js / ws | 3.3.12 / 1.2.1 / 8.20.0 | 3.3.18 / 1.2.2 / 8.21.0 | First compatible fixed versions |
| react / react-dom | 19.2.4 | unchanged | RSC fixes are supplied inside patched Next.js; direct client packages are not the October advisory targets |
| Supabase SSR / JS | 0.10.2 / 2.105.1 | unchanged | Preserve integration contracts |

Next/SWC/image binaries and required helpers follow their patched parents. Unaffected Babel helpers and incidental updates were retained at baseline where compatible. The lockfile change list records the complete closure. No `npm audit fix --force`, unsupported override, framework downgrade or replacement spreadsheet API was used.

Official [Next.js October update](https://nextjs.org/blog/nextjs-security-update-october-14-2026) identifies 16.4.1 as the fixed 16.x release for typed-array cache RCE, image-stack RCE and Server Action DoS. This app uses App Router and Server Actions; Cache Components/use-cache functions and remote-image/SVG opt-ins were not found. The version ranges match, but not all exploit preconditions are present. Upstream React [RSC RCE](https://github.com/react/react/security/advisories/GHSA-xqc2-xf4c-x3h3) and [Server Function DoS](https://github.com/react/react/security/advisories/GHSA-h3gv-c5rc-p453) are addressed through the framework's bundled implementation, not by installing an unrelated standalone RSC package.

The baseline npm audit reports 17 affected package entries, including one critical entry. All **63 unique advisory records** were retrieved from GitHub's official Advisory Database and checked for package ranges/fixed versions and withdrawal status. None were withdrawn. The [advisory matrix](./MINERVA-SECURITY-001-advisories.md) distinguishes version matches from deployed exploitability: 62 no longer match, one dev-only advisory remains. Production-only audit is now **zero**; full audit retains five high package entries from one unfixed development-only `braces` advisory.

## SheetJS exposure and compatibility

`features/entry/communities/unitsImport.ts` parses user-selected XLSX/CSV files and pasted text in the browser and generates a unit template. `features/entry/outrider/setupReport/workbook.ts` reads uploaded workbook bytes on the server and writes templates/reports; the corresponding actions require Superadmin. Files are not inherently trustworthy because an authorized operator uploaded them. Existing row/sheet/string/formula checks run after library parsing and cannot replace a parser security fix. Public Outrider attachments are stored separately; that upload alone was not found to invoke this parser.

The official [prototype-pollution advisory](https://cdn.sheetjs.com/advisories/CVE-2023-30533) affects versions through 0.19.2 when reading crafted files; the [ReDoS advisory](https://cdn.sheetjs.com/advisories/CVE-2024-22363) affects versions through 0.20.1. Thus both are relevant to existing read paths, not merely export-only version matches.

Used the official **0.20.3** archive and its recommended [vendoring installation](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/), retaining the `xlsx` import/API. Archive SHA-256: `8dc73fc3b00203e72d176e85b50938627c7b086e607c682e8d3c22c02bb99fe8`; inspected metadata says `xlsx` 0.20.3, Apache-2.0. npm's lockfile records SHA-512 integrity. No independent upstream signature was available in the inspected release documentation. Clean installation works from the tracked local archive, without depending on CDN availability at deployment time. See [vendor documentation](../../vendor/README.md).

Existing workbook contracts and safety validations pass. Added a real XLSX byte-upload round trip through the existing units parser, covering accents, references, resident fields and unit-only rows. No format or feature was removed. The server code uses buffer APIs, not the ESM filesystem APIs that require separate injection in the newer release. Limits on arbitrary compressed-file resource consumption remain an application-level consideration; no parser migration makes every malicious file harmless.

## Test evidence

Commands used Node **24.22.1**, npm **11.19.1**, a clean clone and synthetic/local fixture configuration. No production credentials or data were used. CI was on EOL Node 20; each existing job now pins 24.22.1, matching `.nvmrc` and `engines.node` (`>=24.22.1 <25`). The existing auth CI job also runs the new executable auth regression and units-import tests. The build prints its Node version. Existing jobs/actions and lint-exception policies are otherwise unchanged.

| Check | Baseline | Patched |
| --- | --- | --- |
| Clean install | PASS (`npm ci --ignore-scripts --no-audit`) | PASS (`npm ci --no-audit`) |
| Production build | PASS, Next 16.2.4 | PASS, Next 16.4.1; 69 generated pages |
| Type checking | TypeScript passes within baseline build | PASS (`next typegen`, `tsc --noEmit`) |
| Full existing tests plus added tests | 643 total, 601 pass, 42 fail | 650 total, 608 pass, **same 42 failures**, no new failures |
| Focused auth/workbook regressions | Existing workbook tests available | **34/34 PASS** |
| Lint | 2 errors, 13 warnings | Same 2 errors, 15 warnings; no new errors |
| npm audit, full | 17 affected package entries | 5 high entries, one underlying dev-only advisory |
| npm audit, production only | Known affected runtime dependencies | **0 vulnerabilities** |
| Brain guardrails | Linux CI baseline policy retained | Linux CI PASS; local Windows freshness check fails on CRLF, normalized diagnostic PASS |

Baseline failures include stale source-copy/structure assertions, incomplete fixtures and a syntax error in `tests/minerva-field-foundation.test.mjs`. For example the duplicate-response test failed on expected copy, not a demonstrated resident-data leak, and an email test fixture lacked the updated auth return value. These examples do not establish that all 42 failures are harmless. They remain unfixed and the entire suite is **not passing**. The exact failure-name comparison and logs are retained. The targeted GitHub CI suite does not run every full-suite test: at the first patch commit it completed **16 successful jobs**, with only **Lint (full — informational)** failing under its already-existing `continue-on-error` policy. No exception was added and no required check was bypassed.

Six added executable auth tests run the actual unchanged middleware/access helper with current Next request/response types and synthetic SDK/RPC fixtures: missing-session denial/cookie cleanup, transient outage/cookie preservation, public-registration privacy headers, Superadmin-owner mapping, viewer-vs-owner guard, disabled/unknown-role denial and RPC outage fail-closed handling. They do not establish deployed RLS, real credential login, delivery of invitations/password resets or full browser/dashboard behavior.

No unrelated baseline tests or UI were changed to make checks green. Initial new-harness mistakes (an incorrect parsed-result field, mock syntax and a lint-disallowed variable name) were corrected; the final focused suite passes without application changes. [Evidence files](./evidence/) include baseline/patched audits, build/type/lint logs, focused tests and [exact failure comparison](./evidence/minerva-test-comparison.json). Full before/after test logs are retained as gzip archives to keep the PR small.

The additional local Brain guardrail command failed its exact `LOOP_STATE.md` freshness comparison: Git reports `i/lf w/crlf` for that unchanged file. A separate diagnostic copy of the checker, normalizing only the existing output's CRLF before comparing, reports it up to date; source scripts and Brain data were not modified. The actual Linux CI guardrail job passed. Original failure and diagnostic logs are retained. npm's normal install also warns that `unrs-resolver`'s postinstall is not covered by its install-script allowlist; no permission policy was weakened, and installation/type checks/build still succeeded.

## Residual development advisory

[GHSA-vfj7-8cjw-p6xm / CVE-2026-93687](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) affects `braces` <=3.0.3; the official record has no fixed release. It can exhaust the stack with deeply nested attacker-controlled glob patterns. It remains under the dev-only ESLint/fast-glob/micromatch chain; production dependency listing contains no `braces`. Full audit consequently reports five inherited high entries, not five independent runtime vulnerabilities. Trusted checked-in lint patterns limit exposure; malicious repository/config changes could still crash lint/CI. Do not represent it as fixed. npm's suggested downgrade to eslint-config-next 14.2.35 is incompatible with the focused Next 16 hotfix and was not applied.

## Preview, runtime and backend boundaries

Vercel project `minerva-console` (`prj_ZwNKT2HIloAH6Ukinx6DnmlgEpn4`), region `iad1`, selects Node `24.x`. Patch Preview **`dpl_EsK6u68b5xDUkVSkG8PnDV2YfTj5`** at commit **`541b1be`** is **READY**; its build logs show **Next.js 16.4.1**, builder Node **24.22.1**, successful compilation and TypeScript. [Preview](https://minerva-console-6cqf3wcs0-rudychacon01-9213s-projects.vercel.app/login), [sanitized metadata/HTTP evidence](./evidence/minerva-preview.json).

Credential-free HTTP-only `/login` returned 200 with the existing email/password form; `/products` and `/products/entry/communities` redirected to that form. The deployment connector follows redirects, so those final 200s do not mean protected content was accessible. No browser JavaScript, application credentials or Supabase data request was used for the smoke checks.

A four-line temporary Preview-only addition in the existing server Proxy logged a fixed marker and `process.version` to private Vercel runtime logs. It created no endpoint and exposed no environment values/diagnostic response. Logs tied to real Preview `/login` and protected-path invocations report **`MINERVA-SECURITY-001 runtime-proxy v24.21.0`**, source `function`, region `iad1`, at `2026-10-23T05:39:34.990Z` onward (October 22, 23:39 Guatemala time). See [direct runtime evidence](./evidence/minerva-runtime.txt). The first immediate filtered query was empty; a subsequent deployment-scoped query produced this evidence. **The temporary logging has been removed; final `proxy.ts` matches production source.** Later commits add evidence/CI test wiring and remove the probe; they do not change application/dependency behavior.

The observed function runtime is therefore below the patched **24.22.1** floor despite the patched builder. This directly establishes a remaining issue for those Preview Proxy invocations, not the exact version of Production or every function/region. The [Node October advisory](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases) fixes Brotli RCE and DNS/TLS/HTTP/entropy/permission issues in Node 24.22.1. [Vercel's bulletin](https://vercel.com/kb/bulletin/node-js-security-advisory) describes its provider-managed rollout; inbound WAF coverage does not cover malicious responses fetched by functions. Owner/provider follow-up: request confirmation of Node 24.22.1+ rollout for the project's functions/regions and whether existing deployments require redeployment, or repeat private runtime observation after rollout. No support message was sent on the owner's behalf. This remains separate from the deployable framework fix and does not alone block it.

Read-only environment metadata shows the main Supabase URL, anon key and service-role setting share Preview/Production scope, with no dedicated security-branch override. Values were neither retrieved nor printed. Seshat has Production-only values and an override for a different feature branch, so this Preview is not a verified isolated integration environment. No authenticated Preview tests, database queries, credential changes, infrastructure provisioning or browser telemetry were run. Live login/authorization/RLS, resident registration, activation, household/community writes, invitations and password resets remain unverified end to end; source parity and fixture evidence narrow but do not eliminate compatibility risk.

## Rollback and approval

Current inspected Production: **`dpl_55VRs9Es6gDc3FQ3nTCHuWdY7bWN`**, commit **`f2fec2c6f7f80978b284221b404bc65078f897dc`**, READY, assigned to `console.minervatechs.com`, URL `minerva-console-mwk4i1ut6-rudychacon01-9213s-projects.vercel.app`. Preserve it as the immediately previous production deployment. No claim of authenticated backend health is made from READY status alone.

After explicit approval only, merge through the existing `master` Git integration, which can automatically deploy Production. Approval must cover both actions. Verify the released commit/framework and domain, public credential-free behavior and owner-operated normal login; watch for new auth failures, import errors and critical server exceptions. Stop/revert for a newly observed access-control regression, failed production build or broken critical workflow.

For a release incident, [Vercel Instant Rollback](https://vercel.com/docs/instant-rollback) can restore the exact previous production deployment without a rebuild. Confirm the custom-domain mapping, public health and owner login after rollback. No database rollback is needed because this PR changes no schema/data. Rollback restores vulnerable dependencies and is an emergency availability measure; plan a prompt corrected security release. Rollback also disables automatic production-domain assignment until an approved deployment is promoted. No rollback was performed or preauthorized.

**Next action:** review the PR/evidence and explicitly accept the documented baseline test/lint failures, unfixed dev-only advisory and unverified live flows before approving merge plus production deployment. Do not label this mission fully green. No migration, database write, credential rotation, merge or production deployment is part of this handoff.
