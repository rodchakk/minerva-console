# Minerva Console

Admin console for ENTRY community onboarding, activation, staffing, messaging,
and backend feature controls.

## Current Version

The repository baseline is `0.1.0`.

Recommended release flow from this point:

- `0.1.0`: first production baseline for this stage
- `0.1.1`, `0.1.2`, ...: hotfixes and safe backend fixes
- `0.2.0`: next grouped release with multiple improvements
- `1.0.0`: stable milestone when the product surface feels complete

Detailed release rules live in [docs/release-strategy.md](C:/Dev/minerva-console/docs/release-strategy.md).

## Getting Started

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

Community Registration campaign-link recovery requires:

```bash
ENTRY_CR_CAMPAIGN_LINK_ENCRYPTION_KEY=...
```

Generate a valid 32-byte key with:

```bash
openssl rand -base64 32
```

Use the same stable value in Preview and Production. Do not commit the secret
or rotate it casually; existing recoverable campaign links depend on it.

## Main Areas

- Community onboarding and activation queue
- Resident and operator management
- Community-scoped facilities and messages
- Supabase-backed feature flags for:
  - frequent access
  - reservations
  - messages

## Release Notes

Use [CHANGELOG.md](C:/Dev/minerva-console/CHANGELOG.md) to track what ships in each production update.
