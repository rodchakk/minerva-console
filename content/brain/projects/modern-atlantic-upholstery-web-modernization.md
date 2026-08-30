# MAU-WEB-001 — Modern Atlantic Upholstery Web Modernization

## Status

Planned — discovery/audit substantially complete; implementation has not started.

## Owner

Minerva Technologies.

## Client

Modern Atlantic Upholstery.

## Summary

Rebuild `maupholsteryclt.com` from scratch as a modern, low-cost, high-performance client website owned and operated by Minerva Technologies.

The current site is a WordPress installation on Bluehost. Minerva controls the domain and digital presence, including the domain/DNS path and the Google Business Profile. The modernization must preserve the authority and customer acquisition value already accumulated while removing unnecessary recurring infrastructure cost, improving Minerva's margin, and making the site substantially stronger for traditional search, local search, and AI-assisted discovery.

This is not a cosmetic refresh. It is a complete website, hosting, email, SEO, analytics, and migration modernization.

## Mission objectives

1. Replace WordPress with a modern static-first architecture.
2. Remove Bluehost after both the website and business mailbox no longer depend on it.
3. Preserve existing organic search authority, Google Business Profile, domain continuity, and important URLs.
4. Improve local SEO around Matthews, Charlotte, and nearby service demand.
5. Make Modern Atlantic's services and expertise easy for Google and AI search systems to understand and cite.
6. Improve conversion, especially quote requests from mobile users.
7. Reduce recurring infrastructure cost and improve Minerva Technologies' client-margin profile.
8. Establish a clean Git-backed operating model that is easier for Minerva to maintain than WordPress.

## Current infrastructure audit

### Domain and DNS

- Canonical domain: `https://maupholsteryclt.com/`.
- Registrar: Wix.com Ltd.
- Domain registered: 2022-02-17.
- Current paid term: 2026-02-17 through 2028-02-17.
- Most recent domain invoice: USD 40.70 for two years, approximately USD 20.35/year.
- Current authoritative nameservers:
  - `ns10.wixdns.net`
  - `ns11.wixdns.net`
- Wix reports the domain as pointing away from Wix; this is intentional because the live site is hosted externally.
- Do not use Wix's "Try Again" / reconnect flow during migration planning.

### Current web hosting

Bluehost WordPress Basic Hosting:

- 2025 invoice: USD 35.40/year promotional price.
- 2026 renewal: USD 143.88/year.
- Current web/DNS targets observed include Bluehost IP `50.87.185.121` for the root, `www`, and `mail` host records in Wix DNS.
- WordPress, PHP/plugin endpoints, and the current website runtime are expected to be removed after migration.

### Current email

Active mailbox:

- `info@maupholsteryclt.com`
- Hosted inside Bluehost/cPanel.
- Current quota is a hard 100 MB limit under the hosting setup.
- Mailbox is at/over capacity.
- The inbox contains current customer activity, including recent quote requests, so the mailbox is an active business dependency rather than an abandoned account.
- The mailbox must be migrated and historical mail preserved before Bluehost can be canceled.

Current mail routing:

```text
maupholsteryclt.com
  MX priority 20 -> mail.maupholsteryclt.com
  mail.maupholsteryclt.com -> 50.87.185.121 (Bluehost)
```

Wix has expired historical Google Workspace Starter subscriptions; they are not the active mailbox service and should not be renewed as part of the current plan without a new decision.

### Current confirmed recurring infrastructure cost

- Bluehost: USD 143.88/year.
- Wix domain: approximately USD 20.35/year averaged over the current two-year invoice.
- Current confirmed annualized total: approximately USD 164.23/year.

The cost problem is primarily Bluehost, but Bluehost cannot be removed until both website and email have migrated.

## Google Business Profile audit

Modern Atlantic's existing Google Business Profile is an important asset and must be preserved, never recreated.

Observed current state in August 2026:

- Business name: Modern Atlantic Upholstery.
- Primary category: Upholstery shop.
- Rating: 5.0.
- Google reviews: 59.
- Address shown by Google: Next to Marcelo's Automotive, 616 Arrow Dr Unit C, Matthews, NC 28104, United States.
- Phone: +1 704-247-7382.
- Website: `https://maupholsteryclt.com`.
- Profile is actively managed by Minerva/user account.
- Profile strength shown as "Looks good".

Performance, March-August 2026:

- 999 Business Profile interactions.
- 7,036 Business Profile views.
- Device/platform discovery:
  - 3,865 Google Search mobile — 55%.
  - 2,067 Google Search desktop — 29%.
  - 837 Google Maps mobile — 12%.
  - 267 Google Maps desktop — 4%.
- Mobile is therefore the dominant discovery channel.
- 419 searches showed the Business Profile in search results.

Top visible Business Profile search terms:

1. `upholstery shops near me` — 230.
2. `upholstery` — 92.
3. `upholstery charlotte nc` — 62.
4. `upholstery shops charlotte nc` — 35.
5. Other long-tail terms — <15 in the visible report.

### Google Business services currently listed

The profile contains overlapping service labels, including:

- Auto Interiors
- Auto Interiors Upholstery
- Auto Upholstery
- Automotive Interior
- Automotive Interior Restoration
- Boat Upholstery
- Business Furniture
- Custom Furniture
- Custom Handmade Upholstery
- Custom Marine Upholstery
- Custom Seats
- Custom Upholstery
- Custom Work
- Dining Room Furniture
- Furniture Upholstery
- Headliner Repair
- Interior Restoration
- Marine Upholstery
- Boat upholstery
- Car upholstery
- Classic car upholstery
- Commercial upholstery
- Custom upholstery
- Furniture upholstery
- Motorcycle upholstery

Do not aggressively delete GBP service coverage before the new site taxonomy is finalized. The website should use a cleaner service architecture, then GBP can be normalized carefully.

## Google Search Console baseline

Search Console access has been recovered and is available for the domain.

### Last 12 months baseline

- Total clicks: approximately 1.15K.
- Total impressions: approximately 24.5K.
- Average CTR: 4.7%.
- Average position: 10.9.

This is a strong starting position: the domain already has real organic traffic and on average sits near the page-one/page-two boundary. The goal is to preserve this authority and expand the number of useful landing pages.

### Top visible queries

| Query | Clicks | Impressions |
| --- | ---: | ---: |
| `modern atlantic upholstery` | 106 | 415 |
| `upholstery shops near me` | 70 | 2,070 |
| `upholstery charlotte nc` | 17 | 394 |
| `reupholstery near me` | 17 | 289 |
| `furniture upholstery near me` | 16 | 282 |
| `upholstery near me` | 13 | 426 |
| `furniture reupholstery near me` | 11 | 182 |
| `upholstery shops charlotte nc` | 9 | 371 |
| `upholstery` | 8 | 526 |
| `boat upholstery near me` | 8 | 184 |

Implications:

- Local-intent upholstery searches are the dominant opportunity.
- Charlotte must be represented accurately as a service area while the physical address remains Matthews.
- Furniture/reupholstery has demonstrated search demand and deserves first-class content.
- Marine/boat upholstery also has demonstrated demand.
- The new site should not be built around invented keyword assumptions; these observed queries are the initial evidence base.

### Current page performance

Visible Search Console page totals for the last 12 months:

| URL | Clicks | Impressions |
| --- | ---: | ---: |
| `https://www.maupholsteryclt.com/` | 1,029 | 15,754 |
| `https://maupholsteryclt.com/` | 115 | 10,971 |
| `/services/` | 13 | 945 |
| `/contact/` | 3 | 794 |
| `/about-us/` | 1 | 530 |

The homepage currently carries nearly all organic click value. The rebuild must protect the homepage's semantic strength while creating new service-specific entry points.

### Indexed URLs

The four currently indexed business pages are:

- `/`
- `/services/`
- `/about-us/`
- `/contact/`

Known redirect variants include:

- `https://www.maupholsteryclt.com/`
- `http://maupholsteryclt.com/`
- `http://www.maupholsteryclt.com/`

The canonical direction should remain HTTPS non-www:

```text
http://maupholsteryclt.com/*
http://www.maupholsteryclt.com/*
https://www.maupholsteryclt.com/*
        -> 301 ->
https://maupholsteryclt.com/*
```

Known 404/crawled-not-indexed URLs are WordPress technical residue (`wp-json`, `wp-content`, `wp-includes`, plugin endpoints, and `/feed/`) and do not require equivalent pages in the new site unless a later audit discovers a legitimate external-link dependency.

## Content and positioning direction

The current website under-communicates the breadth and authority of the business. The new site should make the entity relationship explicit:

```text
Modern Atlantic Upholstery
  -> Upholstery shop
  -> Matthews, NC
  -> Serving Charlotte and surrounding areas
  -> Automotive Upholstery
  -> Marine / Boat Upholstery
  -> Furniture / Residential Upholstery
  -> Commercial Upholstery
  -> Custom Upholstery
  -> Real owner/expertise
  -> Real projects and photography
  -> Google reviews and local proof
```

Existing owner/expertise information from the current site should be preserved and verified with the client before publication, including Victor Terzi's long upholstery experience and any competition/award claims.

## Initial site architecture

Preferred initial information architecture:

```text
/
├── services/
├── automotive-upholstery/
├── marine-upholstery/
├── furniture-upholstery/
├── commercial-upholstery/
├── portfolio/
├── about-us/
└── contact/
```

Rules:

- Keep `/`, `/services/`, `/about-us/`, and `/contact/` unless there is a concrete reason to change them.
- `/services/` becomes a true service hub rather than functioning mainly as a portfolio page.
- New service pages must contain substantive real content; do not create thin keyword pages merely for SEO.
- Additional pages such as classic-car upholstery or headliner repair should only be created when enough real content, project proof, and search/business value justify them.

## Conversion direction

The new site should be mobile-first and quote-oriented because mobile dominates discovery.

Preferred quote workflow:

- Name.
- Phone.
- Email.
- Project type: Automotive / Marine / Furniture / Commercial / Other.
- Project description.
- Photo upload.
- Preferred contact method: Call / Text / Email.
- Anti-spam protection.
- Structured notification to `info@maupholsteryclt.com`.

The form should improve lead quality rather than merely replicate the current generic contact form.

## Preferred technical stack

Current preferred direction, to be revalidated against live pricing and platform limits immediately before implementation:

- **Framework:** Astro + TypeScript.
- **Styling/UI:** Astro components with a lightweight styling system; Tailwind is acceptable if it materially speeds delivery without bloating output.
- **Source control:** GitHub, private Minerva-managed repository.
- **Hosting/CDN/runtime:** Cloudflare static hosting / Workers static assets.
- **DNS target:** Cloudflare DNS, while keeping Wix as registrar through the already-paid 2028 term unless a later transfer has a clear economic/operational advantage.
- **Bot/abuse protection:** Cloudflare Turnstile.
- **Quote API:** minimal Cloudflare Worker when server logic is required.
- **Temporary quote-photo storage:** Cloudflare R2 if photo upload is included in MVP.
- **Transactional notification email:** Resend or equivalent low-cost transactional provider.
- **Business mailbox:** Zoho Mail Lite is the current preferred value/safety option for `info@maupholsteryclt.com`; migrate the existing mailbox by IMAP and preserve historical messages.
- **Analytics:** GA4 plus Search Console; Cloudflare Web Analytics may be used as a secondary lightweight operational signal.
- **Search discovery:** Google Search Console, Bing Webmaster/IndexNow where appropriate.

### Why Astro

Modern Atlantic is primarily a content, portfolio, local-business, and lead-generation site. It does not require a permanent application server or a JavaScript-heavy runtime. Static-first output minimizes operational complexity, attack surface, maintenance, and hosting cost while preserving the ability to add small interactive islands when needed.

### Why Cloudflare

The site is a strong fit for edge-served static assets with minimal dynamic work. Cloudflare is preferred because Minerva can combine hosting, CDN, DNS, security, Turnstile, and small Worker/R2 needs while keeping expected infrastructure cost extremely low.

### Why not WordPress

The current business does not need a plugin-heavy PHP/MySQL CMS runtime. WordPress creates recurring hosting cost, plugin/runtime maintenance, technical residue, and unnecessary attack surface for this use case.

### Why not Vercel as the default

Vercel remains technically valid, especially for Next.js, but is not the preferred economic choice for this commercial static-first client project when Cloudflare can serve the expected workload at materially lower recurring cost.

## Preliminary target cost

Current planning estimate, subject to live-pricing verification before purchase or migration:

- Domain at Wix: approximately USD 20.35/year annualized, already paid through 2028.
- Static web hosting: expected USD 0/year at current traffic level.
- Business mailbox: approximately USD 12/year if Zoho Mail Lite pricing remains at the researched level.
- Turnstile / expected small Worker / expected small R2 / expected transactional email usage: target USD 0 within free allowances at current business volume.

Preliminary annualized target: approximately USD 32.35/year while the domain remains at Wix.

This would reduce the current approximately USD 164.23/year baseline by roughly USD 132/year, or about 80%, while materially improving email capacity, maintainability, performance, and Minerva margin.

Do not treat this estimate as a fixed contract price. Recheck provider pricing and terms immediately before implementation or purchase.

## AI/search discoverability direction

Do not build the site around speculative "AI SEO" tricks.

Use durable, machine-readable fundamentals:

- Semantic HTML.
- Clear entity/business identity.
- Accurate NAP information.
- LocalBusiness/Organization structured data where valid.
- Service information expressed in real page content and appropriate structured data.
- Strong internal linking.
- Real project photography and descriptive context.
- Owner/expertise information that can be verified.
- Reviews/social proof represented without fabricating structured review claims.
- Clean metadata, canonical tags, sitemap, robots rules, and Open Graph data.
- Preserve Google Business Profile and Search Console continuity.
- Allow legitimate search crawlers needed for discovery; bot policies for training vs search should be an explicit deployment decision rather than an accidental default.

The goal is to make the business easy for Google, Bing, ChatGPT search, Gemini, Copilot, Perplexity, and future answer engines to understand from the same high-quality source of truth.

## Migration strategy

The website and email are separate workstreams.

### Phase 0 — preserve and document

- Preserve current Search Console access and baseline.
- Preserve Google Business Profile.
- Export/copy current DNS records before nameserver changes.
- Inventory current WordPress pages, assets, forms, plugins, and high-value photography before shutdown.
- Back up the existing WordPress site before destructive changes.

### Phase 1 — email risk removal

The active Bluehost mailbox is currently the most immediate operational risk because its 100 MB quota is full.

Before Bluehost cancellation:

1. Create the replacement mailbox for `info@maupholsteryclt.com`.
2. Migrate historical mail by IMAP or another verified method.
3. Configure new MX/SPF/DKIM/DMARC records.
4. Verify inbound and outbound mail.
5. Keep Bluehost active during a safe overlap window.
6. Confirm no customer mail is lost.

### Phase 2 — build website independently

- Build the Astro site in GitHub.
- Deploy to a preview/staging URL before touching production DNS.
- Implement redirects, canonicals, metadata, structured data, sitemap, robots, analytics, and forms.
- Validate mobile performance and accessibility.
- Verify all old indexed URLs have a deliberate outcome.

### Phase 3 — DNS/hosting cutover

Preferred target is to move authoritative DNS from Wix nameservers to Cloudflare while keeping Wix as registrar during the paid term.

Before changing nameservers:

- Recreate every required existing record in Cloudflare, especially active mail records and Google verification tokens.
- Compare Wix and Cloudflare zones record-by-record.
- Confirm the replacement email service is already functioning or deliberately preserve the temporary Bluehost mail route.

Then:

- Point root and `www` to the new web deployment.
- Preserve HTTPS non-www canonical redirects.
- Verify SSL, forms, analytics, Search Console, sitemap, and Business Profile website link.

### Phase 4 — decommission Bluehost

Only cancel Bluehost after all of the following are true:

- New website is live and stable.
- `info@maupholsteryclt.com` sends and receives from the replacement provider.
- Historical mail has been preserved.
- No required DNS record points to Bluehost.
- Search Console shows no critical migration issue.
- Final WordPress/site backup is retained according to Minerva's chosen archive policy.

## Acceptance criteria

MAU-WEB-001 is successful when:

1. Modern Atlantic is running on the new non-WordPress site at the existing domain.
2. The existing Google Business Profile, reviews, phone, address, and website identity remain continuous.
3. The four currently indexed core URLs remain valid or have correct permanent redirects.
4. HTTPS non-www remains canonical.
5. The homepage preserves existing broad local relevance while new service pages create additional organic entry points.
6. Mobile quote conversion is materially better than the current site.
7. `info@maupholsteryclt.com` is migrated off Bluehost with historical email preserved and substantially more than 100 MB capacity.
8. Bluehost is no longer required and can be canceled safely.
9. Search Console, analytics, sitemap, robots, and structured data are operational.
10. The site is fast, accessible, secure, Git-backed, and inexpensive for Minerva to maintain.
11. Recurring infrastructure cost is materially below the current approximately USD 164.23/year baseline.

## Guardrails

- Do not recreate the Google Business Profile.
- Do not change the business's physical address to Charlotte; use Matthews accurately and describe Charlotte as a served market.
- Do not cancel Bluehost until both web and email dependencies are gone.
- Do not remove existing MX/TXT/CNAME records casually during DNS migration.
- Do not delete old Google verification tokens during migration unless their ownership/use is understood and removal is intentionally approved.
- Do not change the canonical domain from non-www without a compelling documented reason.
- Do not create thin SEO doorway pages.
- Do not publish unverifiable awards, years-of-experience claims, service claims, or customer-review claims.
- Do not make provider purchases based only on this planning snapshot; recheck live pricing and current commercial-use terms first.

## Next working session

When work resumes:

1. Treat this document as the operational starting point.
2. Perform the remaining WordPress asset/content/plugin backup inventory.
3. Resolve the active mailbox migration first because it is at capacity.
4. Freeze the v1 content/IA and design direction.
5. Create the dedicated website repository and implementation branch.
6. Build the preview without touching production DNS.

## Current decision

Proceed with a complete Modern Atlantic Upholstery web modernization owned by Minerva Technologies. The preferred implementation is Astro + TypeScript on Cloudflare, with a separate dedicated mailbox provider and a staged migration that protects Google authority, active email, and production continuity. The current site remains live until the replacement has passed migration checks.
