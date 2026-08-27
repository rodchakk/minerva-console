# MINERVA-FIELD-001A - Technical Recon and Implementation Prep

## Status

- Mission: `MINERVA-FIELD-001A: Technical recon and implementation prep`
- GitHub issue: [#73](https://github.com/rodchakk/minerva-console/issues/73), open at recon time
- Product-direction PR: [#70](https://github.com/rodchakk/minerva-console/pull/70), draft, `product/minerva-field-foundation` -> `master`
- Recon branch: `codex/minerva-field-001a-recon`
- Base inspected: `origin/master` at `4ea3dc7` (`Brain: capture ENTRY-OPS-001 closeout (#72)`)
- Scope: documentation/recon only. No Minerva Field UI, auth, Supabase, service-worker, dependency, runtime, or schema changes.
- MINERVA-FIELD-001B update: older Seshat/future-module references in this recon are superseded by the final product direction in `minerva-field-foundation.md`; the Field foundation exposes ENTRY only, with no Seshat card, route, registry entry, or placeholder.
- MINERVA-FIELD-001C resolved the 001B login-return limitation by preserving safe `/field` and `/field/*` post-login destinations while keeping all missing, unsafe, or non-Field destinations on the normal `/dashboard` fallback.

## Product Direction Inputs

`content/brain/projects/minerva-field-foundation.md` exists only on PR #70 / `product/minerva-field-foundation`. It says Minerva Field should be a mobile-first installable PWA inside Minerva Console, Minerva-level rather than ENTRY-only, with `Home`, `ENTRY`, future/disconnected `Seshat`, and `Account`.

Important branch divergence:

- `origin/product/minerva-field-foundation` adds `content/brain/projects/minerva-field-foundation.md` and updates `content/brain/registries/projects.json`.
- `origin/master` has moved ahead with `e6f52b8` and `4ea3dc7`, including ENTRY-OPS-001 and its Brain closeout at `content/brain/projects/entry-operational-activity-feed.md`.
- Therefore PR #70 is a product input, not a technical base branch for implementation.

## Current Web / PWA Baseline

### Stack and App Router

- `package.json` pins `next` to `16.2.4`, `eslint-config-next` to `16.2.4`, `react`/`react-dom` to `19.2.4`, TypeScript to `^5`, Tailwind to `^4`, `@supabase/ssr` to `^0.10.2`, `@supabase/supabase-js` to `^2.105.1`.
- `app/` is the active App Router tree. There is no `pages/` directory.
- Route groups:
  - `app/(console)/layout.tsx` protects the desktop/admin console and wraps children in `components/layout/Shell.tsx`.
  - `app/(public)/entry/register/[slug]/*` holds public resident registration routes and route handlers.
- Top-level routes:
  - `app/page.tsx` redirects by auth context to `/login`, `/dashboard`, or `/unauthorized`.
  - `app/login/page.tsx`, `app/unauthorized/page.tsx`, `app/reset-password/page.tsx`, `app/activate/page.tsx`.
  - `app/api/entry/operational-activity/route.ts`.
- Next 16 local docs in `node_modules/next/dist/docs/` confirm:
  - `proxy.ts` is the Next 16 replacement name for middleware.
  - route groups do not affect URL paths.
  - nested layouts wrap child route segments.
  - `app/manifest.ts` / `app/manifest.json` is the built-in manifest file convention at the app root.
  - `metadata.manifest` can emit a route layout/page manifest link to a custom manifest URL.

### Existing Manifests, Icons, Service Workers, PWA Dependencies

- No production manifest exists in the current app tree:
  - no `app/manifest.ts`
  - no `app/manifest.json`
  - no `public/manifest.json`
  - no `public/manifest.webmanifest`
- `rg --files -g "manifest.*"` only found `tmp/presentations/polar-ice-caps/scratch/renders/manifest.json`, unrelated to Minerva Console runtime.
- No service worker exists:
  - no `public/sw.js`
  - no `public/service-worker.js`
  - no runtime `navigator.serviceWorker` registration in `app/`, `features/`, or `components/`.
- No PWA helper dependency is present in `package.json`:
  - no `next-pwa`, `serwist`, Workbox, or equivalent.
- Icons/static assets:
  - `app/favicon.ico`
  - `public/minerva-logo-transparent.png`
  - default-style SVGs in `public/file.svg`, `public/globe.svg`, `public/next.svg`, `public/vercel.svg`, `public/window.svg`
  - no install-ready 192/512 icons or Apple touch icon files.

### Metadata

- `app/layout.tsx` exports root metadata:
  - `title: "Minerva Console"`
  - `description: "Internal global console for Minerva Technologies."`
- `app/(public)/entry/register/[slug]/page.tsx` exports route metadata:
  - title: `Registro de residentes | ENTRY`
  - robots noindex/nofollow
- No Field metadata exists.

### Config, Headers, CSP, Security Headers

- `next.config.ts` defines only one header rule for `/entry/register/:path*`:
  - `Cache-Control: no-store, max-age=0`
  - `Pragma: no-cache`
  - `Referrer-Policy: no-referrer`
  - `X-Robots-Tag: noindex, nofollow`
- There is no global CSP in `next.config.ts`.
- There is no global `X-Frame-Options`, `X-Content-Type-Options`, or `Permissions-Policy` in `next.config.ts`.
- `features/entry/communityRegistration/public/requestSecurity.ts` repeats no-store/no-referrer/noindex headers for public registration JSON routes and enforces a same-origin boundary with `Origin`, `x-forwarded-host`, `x-forwarded-proto`, and `Sec-Fetch-Site`.
- `app/api/entry/operational-activity/route.ts` sets `dynamic = "force-dynamic"` and returns `Cache-Control: private, no-store, max-age=0`.

### Proxy / Middleware

- `proxy.ts` calls `updateSession(request)` from `lib/supabase/middleware.ts`.
- `proxy.ts` matcher excludes `_next/static`, `_next/image`, `favicon.ico`, and image extensions: `svg`, `png`, `jpg`, `jpeg`, `gif`, `webp`.
- The matcher does not exclude `.webmanifest`, `.json`, `/manifest.webmanifest`, `/field.webmanifest`, or future service-worker JS paths.
- Consequence: a future manifest URL or service-worker URL can be redirected to `/login` unless explicitly excluded or treated as public. That is a material PWA installability risk.

### Vercel / Deployment Constraints

- There is no `vercel.json` and no `.openai/hosting.json` in this repo.
- Deployment topology is inferred from Brain closeouts and code:
  - `content/brain/projects/entry-operational-activity-feed.md` says the production deployment for `e6f52b8` reached `READY` and is aliased to `console.minervatechs.com`.
  - `features/entry/deploymentBoundary.ts` uses `VERCEL_ENV`, `ENTRY_PREVIEW_READ_ONLY`, `NEXT_PUBLIC_MINERVA_CONSOLE_URL`, `NEXT_PUBLIC_SITE_URL`, and `ENTRY_PUBLIC_RESIDENT_BASE_URL`.
  - `getResidentFacingBaseUrl()` uses `https://console.minervatechs.com` as production default.
  - Vercel Preview is read-only for ENTRY mutations via `isEntryPreviewReadOnly()`.

## Same-Origin PWA Feasibility

Minerva Field is technically viable on the same origin as Minerva Console, but it should not use the desktop console shell and it should not rely on a global root manifest that turns every route into "Minerva Field".

Recommended architecture:

- URL namespace: `/field/*`
- App Router location: `app/(field)/field/*`
- Field shell component location: `components/field/FieldShell.tsx` plus small field-specific nav/header components.
- Shared tokens: keep using `app/globals.css` semantic tokens and shared UI primitives where they fit.
- Dedicated manifest URL: `/field.webmanifest` or `/field/manifest.webmanifest`, linked from `app/(field)/field/layout.tsx` via metadata.
- Manifest `start_url`: `/field`
- Manifest `scope`: `/field`
- Manifest `id`: `/field`
- Display: `standalone`
- No custom service worker in v1 unless later required for push/offline.

Why this is cleaner than a root `app/manifest.ts`:

- Next's file convention supports `app/manifest.ts` at the app root, which is good for one app identity, but Minerva Console and Minerva Field need different launch identities.
- `metadata.manifest` in the field layout can link only Field routes to a dedicated manifest while the desktop Console remains a browser/admin surface.
- A static or route-handler manifest contains no sensitive data and should be public or proxy-excluded.

Platform notes verified against local Next 16 docs and public platform docs:

- Next docs say a PWA needs a valid manifest and HTTPS for installability, and explicitly note install prompts can be supported without offline support.
- Chromium/Android supports manifest-driven install and can launch to `start_url`; MDN notes `start_url` is a browser hint, must be same-origin with the installing page, and should not contain user-specific tracking/fingerprinting data.
- MINERVA-FIELD-001B uses `scope: "/field"` so the exact `start_url: "/field"` is inside the installed app scope.
- iOS Safari Add to Home Screen is manual. It does not support the same `beforeinstallprompt` flow as Chromium, so Field cannot depend on a custom install prompt as the primary iPhone UX.
- iOS installed web apps have platform-specific limitations around install prompting, browser UI, storage lifecycle, background execution, and service-worker behavior. Architecture should degrade to "Field opens in browser or installed standalone" with server-fresh data, not assume native-app parity.

External references consulted for this section:

- Next local docs: `node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md`
- Next local docs: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/manifest.md`
- MDN Web App Manifest overview: https://developer.mozilla.org/docs/Web/Progressive_web_apps/Manifest
- MDN manifest `start_url`: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/start_url
- MDN manifest `scope`: https://developer.mozilla.org/docs/Web/Progressive_web_apps/Manifest/Reference/scope
- MDN `beforeinstallprompt`: https://developer.mozilla.org/docs/Web/API/Window/beforeinstallprompt_event
- Web.dev installability guidance: https://web.dev/learn/pwa/installation
- Web.dev web app manifest guidance: https://web.dev/learn/pwa/web-app-manifest
- WebKit iOS Home Screen web apps and push: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- Apple Configuring Web Applications: https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html

## Auth And Authorization Findings

### Current Flow

- `lib/supabase/middleware.ts` runs for non-excluded routes through `proxy.ts`.
- Public unauthenticated routes today:
  - `/login`
  - `/unauthorized`
  - `/activate`
  - `/activate/*`
  - `/reset-password`
- Public registration routes:
  - `/entry/register`
  - `/entry/register/*`
  - These are not session-protected and get no-store/noindex/no-referrer headers.
- All other routes redirect unauthenticated users to `/login?next=<pathname>`.
- `app/(console)/layout.tsx` calls `requireSuperadmin()` and then renders `Shell`.
- `features/auth/requireSuperadmin.ts` uses Supabase `auth.getUser()` plus RPC `is_superadmin`.
- Most ENTRY queries/actions independently call `requireSuperadmin()`, including:
  - `features/entry/communities/queries.ts`
  - `features/entry/communities/actions.ts`
  - `features/entry/staff/actions.ts`
  - `features/entry/users/actions.ts`
  - `features/entry/communityRegistration/admin/actions.ts`
  - `features/entry/communityRegistration/review/actions.ts`
  - `features/entry/activation/*Actions.ts`
  - `features/entry/operations/queries.ts`

### Session / Logout / Redirect Risks

- `features/auth/actions.ts` login currently ignores the `next` parameter set by the proxy and redirects authorized users to `/dashboard`.
- This is acceptable for desktop Console today, but bad for a standalone Field PWA: launching `/field` while signed out would authenticate, then leave the installed Field context for `/dashboard`.
- `features/auth/actions.ts` signout calls `supabase.auth.signOut({ scope: "local" })` and redirects to `/login`.
- No route stores or restores display-mode state. A future Field login flow may need an allowed, sanitized `next=/field...` redirect.
- The proxy only verifies session presence. Superadmin authorization remains in layouts/server functions. Field must add its own protected layout with `requireSuperadmin()` and should not trust client-only route hiding.

## Shell And Routing Recommendation

Current desktop shell:

- `components/layout/Shell.tsx` is a client component with sidebar state, `Topbar`, `AppSidebar`, preview read-only banner, desktop `lg:pl-64`, and max-width content container.
- `components/layout/Topbar.tsx` hardcodes breadcrumb text: `Minerva Console / ENTRY / Operations`.
- `components/layout/AppSidebar.tsx` hardcodes ENTRY and Brain nav groups and active matching for `/dashboard`, `/products/entry`, `/activate`, and `/brain`.
- `app/globals.css` defines Visual System v2 tokens and global Tailwind import.

Recommendation:

- Do not extend `components/layout/Shell.tsx` for Field.
- Do not mount Field under `app/(console)/layout.tsx`, because that inherits desktop nav, Brain links, `lg:pl-64`, and ENTRY-specific breadcrumb language.
- Add a sibling route group:

```text
app/(field)/field/layout.tsx
app/(field)/field/page.tsx
app/(field)/field/entry/page.tsx
app/(field)/field/entry/communities/page.tsx
app/(field)/field/entry/communities/[communityId]/page.tsx
app/(field)/field/entry/communities/[communityId]/units/page.tsx
app/(field)/field/entry/communities/[communityId]/units/[unitId]/page.tsx
app/(field)/field/entry/communities/[communityId]/registration/page.tsx
app/(field)/field/entry/search/page.tsx
app/(field)/field/account/page.tsx
```

Recommended future placeholder, only when product approves:

```text
app/(field)/field/seshat/page.tsx
```

Supporting code:

```text
components/field/FieldShell.tsx
components/field/FieldTopbar.tsx
components/field/FieldTabbar.tsx
features/field/modules.ts
features/field/types.ts
features/entry/field/*
```

The `features/field/modules.ts` pattern should be a small typed module registry, not a plugin framework. Example shape: product id, label, status (`active`, `future`, `disabled`), href, and optional badge/description. ENTRY can register active Field destinations; Seshat can be listed as future without runtime integration.

## ENTRY Reuse Inventory

| Area | Classification | Evidence | Why |
| --- | --- | --- | --- |
| Community list data | B. Reusable with thin mobile presentation layer | `features/entry/communities/queries.ts`, `app/(console)/products/entry/communities/page.tsx` | `listCommunitiesWithProgress()` is server-only and already superadmin-gated. Desktop page/filter cards are useful product logic but table/list presentation is desktop-heavy. |
| Community list UI | C. Desktop-coupled | `features/entry/communities/CommunityList.tsx` | Uses `min-w-[1240px]`, desktop row grid, overflow table behavior, and includes deactivate/reactivate menu. Needs mobile cards and action pruning. |
| Community detail data | B | `features/entry/communities/detailQueries.ts`, `features/entry/communities/queries.ts` | `getCommunityWithProgress()`, `getCommunityOnboardingDetail()`, and preview queries are good server sources. |
| Community detail UI | C | `app/(console)/products/entry/communities/[communityId]/page.tsx` | Already has field-relevant concepts, but mixes quick actions, drawers, tables, facilities, messages, review, and desktop layout. |
| Units list data | B | `features/entry/communities/detailQueries.ts`, `app/(console)/products/entry/communities/[communityId]/units/page.tsx` | `getCommunityUnitsPageData()` is reusable; Field needs smaller, search-first unit cards. |
| Units create | B/C | `app/(console)/products/entry/communities/[communityId]/units/new/page.tsx`, `features/entry/communities/actions.ts` | `addCommunityUnitsAction()` is guarded and preview-safe. Current textarea bulk import is not ideal one-handed but can be wrapped for "add one/few units". |
| Unit detail | B | `app/(console)/products/entry/communities/[communityId]/units/[unitId]/page.tsx`, `features/entry/communities/detailQueries.ts` | Read-only details are Field-relevant. UI should be rebuilt mobile-first. |
| Unit edit/status | D for Field v1 unless explicitly approved | `features/entry/communities/CommunityUnitQuickActions.tsx`, `features/entry/communities/unitActions.ts` | Edits and disabling a unit also toggles linked resident memberships. High operational blast radius for a first Field release. |
| Community Registration admin state | B | `features/entry/communityRegistration/admin/queries.ts`, `features/entry/communityRegistration/admin/CommunityRegistrationCard.tsx` | Campaign status, submitted counts, participating units, and recoverable link state are core Field read/action candidates. |
| Launch registration campaign | C/D for v1 | `features/entry/communityRegistration/admin/actions.ts` | Secure and guarded, but campaign creation selects units and creates public links. Good later action, not first read-only Field slice. |
| Recover/share registration link | B | `features/entry/communityRegistration/admin/actions.ts`, `CommunityRegistrationCard.tsx` | `recoverCommunityRegistrationLink()` is guarded, verifies campaign/community/open state, decrypts recoverable token, and returns URL. Strong Field candidate with mobile share/QR layer. |
| Replace registration link | D for Field v1 | `replaceCommunityRegistrationLink()` in `features/entry/communityRegistration/admin/actions.ts` | Invalidates previous active link. Keep desktop or require separate hardening/confirmation mission. |
| QR generation | B, new presentation only | No QR package currently in `package.json`; link recovery is in `features/entry/communityRegistration/admin/actions.ts` | QR can be generated from the recovered URL with a small dependency or browser-native canvas/SVG only after product chooses. Do not add dependency in recon. |
| Public registration pages | A for their existing public purpose, not Field shell | `app/(public)/entry/register/[slug]/*`, `features/entry/communityRegistration/public/*` | Already no-store, token/cookie protected, rate-limited, and same-origin checked. Field should link/share these, not embed Brain or duplicate public registration runtime. |
| Registration review | C/D | `features/entry/communityRegistration/review/ReviewWorkspace.tsx`, `features/entry/communityRegistration/review/actions.ts` | Powerful review/confirm/correction flows are guarded but complex and desktop-oriented. Consider later after mobile task analysis. |
| Global user search | B/C | `app/(console)/products/entry/users/page.tsx`, `features/entry/users/UserSearch.tsx`, `features/entry/users/actions.ts` | Data/action exists. UI is table/menu desktop. Password reset/recovery actions expose credentials and need explicit Field policy. |
| Community users | B/C | `app/(console)/products/entry/communities/[communityId]/users/page.tsx`, `features/entry/users/CommunityUsersClient.tsx`, `features/entry/users/queries.ts` | Searchable support workspace, but current client likely too dense for v1. |
| Guards/staff lookup | B | `features/entry/staff/actions.ts`, `app/(console)/products/entry/communities/[communityId]/staff/page.tsx` | `getCommunityStaffPageData()` can power quick lookup of admins/guards. |
| Create guard | D for Field v1 | `createGuardAction()` in `features/entry/staff/actions.ts` | Creates Supabase Auth users via service-role client and temporary passwords. High-risk mobile action. |
| Promote resident admin | D for Field v1 | `promoteResidentAdminAction()` in `features/entry/staff/actions.ts` | Changes authorization role. Keep out until product explicitly needs it in field. |
| Activation queue overview | B | `app/(console)/products/entry/activation/page.tsx`, `features/entry/activation/actions.ts` | Counts, selected community, queue state are useful for go-live validation. |
| Generate activation PINs | D unless selected as safe field action | `features/entry/activation/pinActions.ts`, `ActivationQueueTable.tsx` | PINs are temporary credentials shown once and often shared over WhatsApp. Useful in field but sensitive. Needs dedicated mobile confirmation/audit UX. |
| Create activated users | D for early Field | `features/entry/activation/createUserActions.ts` | Creates active users and temporary passwords. Too much blast radius for v1 foundation. |
| Send activation emails | C/D | `features/entry/activation/emailActions.ts` | Potentially Field-useful, but requires careful confirmation, delivery result handling, and preview/production clarity. |
| Operational Activity | B | `app/api/entry/operational-activity/route.ts`, `features/entry/operations/queries.ts`, `features/entry/operations/OperationalActivityFeed.tsx` | Query/API are reusable. Desktop table component is not. Field should use a small activity stream with explicit freshness. |
| Onboarding/readiness | B | `features/entry/communities/queries.ts`, `features/entry/communities/CommunityOnboardingReadinessPanel.tsx`, `features/entry/onboardingCopy.ts` | Data and copy are reusable. Panel is desktop-oriented. Completion action should be gated later. |
| Complete onboarding | D for Field v1 | `completeCommunityOnboardingAction()` in `features/entry/communities/onboardingActions.ts` | Activates community after readiness checks. High significance; not first mobile action. |
| Community deactivate/reactivate | D | `features/entry/communities/statusActions.ts` | Direct service-role fallback updates communities, profiles, memberships, and frequent visitors. Keep desktop-only for now. |
| Messages/support actions | C/D | `features/entry/messages/*`, `app/(console)/products/entry/messages/page.tsx` | Sending official messages may be field-useful but can affect residents broadly. Needs product decision and mobile confirmation design. |

## Data / API Boundary Recommendation

Use a hybrid, but default to Server Components and Server Actions.

Recommended split:

- Read pages: Server Components call existing server-only queries directly.
- Mutations: Server Actions, reusing existing guarded ENTRY actions only after action-specific Field review.
- Polling/refreshing client widgets: thin internal API routes only where the UI needs background refresh, as `app/api/entry/operational-activity/route.ts` already does.
- Public resident registration: keep existing public route handlers and public shell separate from Field.

Tradeoffs:

- Auth: Server Components and Server Actions reuse cookies, `requireSuperadmin()`, and existing Supabase clients. Thin APIs must also call `requireSuperadmin()` and return no-store.
- Reuse: Direct server queries avoid duplicating business logic. New Field UI can be small while sharing data contracts.
- Mobile UX: APIs are useful for pull-to-refresh, polling activity, and optimistic UI, but should remain thin.
- Caching: Server reads should be dynamic/no-store for operational truth. Client fetches should use `cache: "no-store"`.
- Security: No parallel backend. No client-side service-role access. No Field-only auth shortcuts.
- Future Seshat: a shared Field module shell can call product-specific server modules without forcing one API shape across products too early.

## Caching / Offline Recommendation

V1 should not be offline-first.

Minimum safe approach:

- Cache only browser/Next-managed static assets such as hashed `_next/static/*`, fonts, and public install icons.
- Do not cache operational ENTRY data as offline truth:
  - communities
  - units
  - residents/users
  - guards/staff
  - activation/PIN/temporary credentials
  - registration campaign tokens/URLs
  - activity feed
  - onboarding readiness
- Add no custom service worker for v1 unless push notifications or explicit offline UX becomes a product requirement.
- Make Field read routes dynamically fetch current server data and show clear load/error states.
- For client refresh endpoints, use no-store like `app/api/entry/operational-activity/route.ts`.
- If a future service worker is introduced, serve it from `/field/sw.js`, register it with scope `/field/`, and set no-store headers for the worker script itself.
- Do not use a root-scoped service worker (`/sw.js` with scope `/`) unless product explicitly wants it to affect all Minerva Console routes.

Deploy-cache risk:

- A stale root-scoped service worker can survive deploys and control desktop Console unintentionally.
- A stale manifest can continue launching old `start_url` or icon metadata.
- Mitigation: version manifest/icon filenames when needed, set conservative headers for manifest/SW, and run install QA after production deploy.

## Extensibility Model

Use a small Field module registry rather than a plugin framework.

Proposed model:

- `features/field/modules.ts` exports a typed list of modules for Field home/navigation.
- Each module declares `id`, `label`, `status`, `href`, and optional `quickActions`.
- ENTRY owns `features/entry/field/*` UI adapters and reads from existing `features/entry/*` server code.
- Future Seshat should add `features/seshat/field/*` and a registry entry when its runtime exists.
- Field shell owns cross-product navigation, account/logout, install-oriented metadata, and mobile layout.
- Product modules own product data and action policies.

This keeps Field Minerva-level while avoiding overbuilt plugin machinery.

## Risk Register

| Risk | Severity | Evidence | Mitigation |
| --- | --- | --- | --- |
| Login from standalone `/field` redirects to `/dashboard` | High | `lib/supabase/middleware.ts` sets `next`, but `features/auth/actions.ts` login ignores it and redirects authorized users to `/dashboard` | First implementation PR should support sanitized same-origin `next` paths, including `/field`, without allowing open redirects. |
| Manifest URL intercepted by proxy | High | `proxy.ts` matcher excludes images/favicon only, not `.webmanifest` or manifest route handlers | Make manifest public/proxy-excluded and no-store or short-cache. Add test. |
| Service worker scope accidentally controls Console | High | No SW exists today; Next PWA docs examples use `/sw.js` scope `/` | Do not add SW for v1. If needed later, serve from `/field/sw.js` with `/field/` scope. |
| Field inherits desktop Shell | Medium | `components/layout/Shell.tsx`, `Topbar.tsx`, `AppSidebar.tsx` hardcode desktop structure and Brain/ENTRY navigation | Use sibling `(field)` route group with separate Field shell. |
| Accidental exposure of desktop/high-risk actions | High | Current desktop components include deactivate community, create users, create guards, password recovery, link replacement, onboarding completion | Field module registry/action policy must whitelist actions per mission. Do not import desktop pages wholesale. |
| Stale operational data shown as current | High | Operational activity currently polls no-store every 30s; no offline-first requirement | Field activity/read views must label freshness and never serve cached operational data as truth. |
| Preview vs Production confusion | Medium | `features/entry/deploymentBoundary.ts` makes Preview read-only and resident URLs production-canonical | Field shell must show the existing preview read-only banner and disable write actions in Preview. |
| ENTRY regression from shared refactor | High | ENTRY is first-customer operational and ENTRY-OPS-001 is deployed | Avoid refactors in foundation. Add mobile adapters over existing server contracts first. |
| PR #70 branch is behind master | Medium | `origin/master` has ENTRY-OPS-001 commits not in PR #70 | Treat PR #70 as product direction only. Build from current master. |
| Route-specific manifest implementation uncertainty | Medium | Next root file convention is `app/manifest.ts`, while Field needs distinct app identity | Prefer field layout `metadata.manifest` pointing to a public custom manifest route/static file; verify built head tags in PR 1. |
| iOS install UX differs from Chromium | Medium | iOS Safari has no reliable `beforeinstallprompt` flow | Use simple in-app install education only; do not block product UX on a custom install button. |
| Public registration token leakage through Field share UX | High | `recoverCommunityRegistrationLink()` returns tokenized URLs; public registration uses token hash/cookie | Field share/QR UI must avoid logging URLs, avoid caching, and require explicit user action. |
| CSP missing before adding PWA surfaces | Medium | No global CSP/security headers in `next.config.ts` | Add a minimal security-header PR or include in foundation PR after testing with Next/font/Supabase. |

## Implementation Mission Breakdown

### MINERVA-FIELD-001B - Field Routing, Shell, Manifest Foundation

- Objective: create protected `/field` surface with Field shell, account/logout entry point, product-level home, and dedicated manifest link.
- Scope: `app/(field)/field/layout.tsx`, `app/(field)/field/page.tsx`, `components/field/*`, `features/field/modules.ts`, `public/*field-icons*`, manifest route/static file, proxy tests for manifest accessibility.
- Dependencies: product approval of Field name/icon/colors and install copy.
- Risk: Medium.
- Acceptance criteria:
  - `/field` requires session and superadmin authorization.
  - `/field` does not render `AppSidebar` or desktop `Topbar`.
  - manifest launches to `/field` and scopes to `/field/`.
  - manifest is fetchable without auth redirects and contains no sensitive data.
  - no service worker added.
- QA/tests:
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - browser check of `/field`, `/field.webmanifest`, login redirect, desktop `/dashboard`.
  - Android/Chromium install smoke test if deployment is available.

### MINERVA-FIELD-001C - Auth Redirect And Standalone Hardening

- Objective: make protected Field standalone launch recover gracefully after login/session expiry.
- Scope: `features/auth/actions.ts`, `features/auth/LoginForm.tsx`, `app/login/page.tsx`, auth tests.
- Dependencies: approve allowed `next` destinations. Recommended allowlist: same-origin paths beginning `/field`, `/dashboard`, `/products/entry`, `/brain`; default `/dashboard`.
- Risk: High because auth changes affect all Console login.
- Acceptance criteria:
  - unauthenticated `/field/entry/...` redirects to `/login?next=/field/entry/...`.
  - successful superadmin login returns to the sanitized `next`.
  - non-superadmin users still go to `/unauthorized`.
  - external or malformed `next` values cannot redirect off-site.
- QA/tests:
  - targeted auth tests.
  - manual login from browser and standalone display-mode simulation.

### MINERVA-FIELD-002 - ENTRY Read-Only Field Overview And Search

- Objective: add first functional ENTRY Field read surfaces without write actions.
- Scope: `app/(field)/field/entry/*`, `features/entry/field/*`, reuse `features/entry/communities/queries.ts`, `features/entry/communities/detailQueries.ts`, `features/entry/users/actions.ts` or a read-only query wrapper.
- Dependencies: decide exact MVP field scenarios for sales visit, setup visit, and go-live validation.
- Risk: Medium.
- Acceptance criteria:
  - mobile-first community list/search.
  - community detail shows current setup/readiness, units count, activation pending, registration state.
  - no create/update/delete/credential action buttons.
  - no Brain or desktop admin navigation.
- QA/tests:
  - lint/build.
  - responsive checks at iPhone/Android widths.
  - verify data fetches require superadmin.

### MINERVA-FIELD-003 - Safe ENTRY Field Actions

- Objective: introduce narrowly approved low-blast-radius actions.
- Candidate scope: single/few unit creation via `addCommunityUnitsAction`, mark activation queue reviewed, maybe read-only support notes if product defines them.
- Excluded unless re-approved: community deactivate/reactivate, unit disable, create users, create guards, promote admins, replace registration link, complete onboarding.
- Paths: `features/entry/field/actions/*`, existing action wrappers in `features/entry/*`.
- Dependencies: action whitelist from product owner.
- Risk: Medium to High depending on actions.
- Acceptance criteria:
  - every action has server-side `requireSuperadmin()` and preview read-only guard.
  - every action has mobile confirmation and success/failure confirmation.
  - no action depends on client-only authorization.
- QA/tests:
  - targeted action tests.
  - Preview deployment write-block validation.
  - manual mobile tap/confirmation validation.

### MINERVA-FIELD-004 - Community Registration Share And QR

- Objective: let field operator recover/share active registration links and optionally display QR.
- Scope: mobile presentation over `recoverCommunityRegistrationLink()`, optional QR generation after dependency decision, no link replacement by default.
- Paths: `features/entry/field/registration/*`, `features/entry/communityRegistration/admin/actions.ts` only if thin wrappers are needed.
- Dependencies: product decision on QR dependency vs native SVG/canvas, link exposure policy, copy/share behavior.
- Risk: High because tokenized public URLs are sensitive.
- Acceptance criteria:
  - only open, recoverable campaigns can be shared.
  - URL is not cached, logged, or shown until explicit user action.
  - QR/share UI labels expiration/recovery state.
  - no replacement/rotation unless product approves.
- QA/tests:
  - verify no-store behavior.
  - mobile share API fallback check.
  - QR scan test on real device.

### MINERVA-FIELD-005 - Operational Activity And Support Signals

- Objective: surface useful go-live validation and support signals in Field.
- Scope: field-specific activity stream using `features/entry/operations/queries.ts` or a thin `/api/field/entry/operational-activity` route; support lookup views from user/staff data.
- Dependencies: define which operational events are field-relevant and what support actions are allowed.
- Risk: Medium.
- Acceptance criteria:
  - activity shows freshness and handles unavailable state.
  - no stale cache.
  - no raw metadata, tokens, emails/phones beyond approved support context.
- QA/tests:
  - endpoint no-store checks.
  - mobile refresh/visibility behavior.

### MINERVA-FIELD-006 - Device Install QA And Production Hardening

- Objective: harden installability, headers, visual behavior, and production rollout.
- Scope: manifest headers, icon set, optional CSP/security headers, production/preview QA checklist, docs.
- Dependencies: production preview URL and device access.
- Risk: Medium.
- Acceptance criteria:
  - Android/Chromium install launches `/field`.
  - iOS Add to Home Screen launches `/field` or documented acceptable fallback.
  - session expiry returns to login and back to Field after auth.
  - desktop Console remains unaffected.
  - Preview write guard is visible and enforced.
- QA/tests:
  - production-like build.
  - browser/device screenshots.
  - install/uninstall/reinstall checks after deploy.

## Open Product / GPT Decisions

- What exact ENTRY field scenarios define MVP: sales visit, onboarding visit, go-live validation, support visit, or all four?
- Should Field v1 include any write action, or should first release be read-only plus share/QR?
- Are activation PIN generation and direct user creation acceptable on phone, or desktop-only?
- Should registration link replacement/rotation ever be available in Field?
- What is the canonical Field product name and icon set: `Minerva Field`, `Field`, or `Minerva`?
- Should Seshat appear as a disabled/future card in v1, or only be supported in code architecture?
- What are the exact allowed login `next` destinations?
- Does Field need a custom install education screen for iOS, or only passive Add-to-Home-Screen support?
- Should a minimal global security-header/CSP pass happen before or during the Field foundation PR?
- Should Preview Field be usable read-only for demos, or hidden behind a stronger environment warning?

## Bottom Line

Build Minerva Field in the same Next.js app and same origin, but as a sibling mobile product surface under `/field/*`, protected by the existing auth model and backed by existing ENTRY server code. Add a dedicated public manifest and icons, do not add a service worker for v1, and fix sanitized post-login return before relying on standalone launch. Reuse ENTRY data/query contracts aggressively, but rebuild mobile presentations and whitelist actions slowly.
