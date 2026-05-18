# Release Strategy

## Recommended Versioning

Use semantic versioning with a simple operating rule:

- Patch: `0.1.1`, `0.1.2`
  Use for hotfixes, backend guards, bug fixes, copy changes, and low-risk improvements.
- Minor: `0.2.0`, `0.3.0`
  Use for grouped feature drops, broader UX updates, and release bundles with several improvements.
- Major: `1.0.0`
  Use when the platform is stable enough that you want to mark it as a mature public release.

## Starting Point

Do not move backward to `0.0.1`.

This repository is already at `0.1.0` in [package.json](C:/Dev/minerva-console/package.json), so the clean baseline is:

- Current baseline: `0.1.0`
- Next hotfix: `0.1.1`
- Next bundled improvement release: `0.2.0`

## Practical Rule For Your Workflow

When you are still fixing and tightening production:

- ship urgent fixes as patch releases
- collect broader improvements into the next minor release

Recommended pattern:

1. `0.1.0` first production baseline
2. `0.1.1` backend fixes, activation fixes, guardrails
3. `0.1.2` small follow-up fixes if needed
4. `0.2.0` larger release with many improvements together

## Mobile Build Number Guidance

If the mobile app is shipped through app stores, keep two values:

- Marketing version: `0.1.0`, `0.1.1`, `0.2.0`
- Internal build number: `1`, `2`, `3`, ...

Recommended rule:

- keep the marketing version stable until you are done with that release
- increase the build number every store submission

Example:

- First store submission: version `0.1.0`, build `1`
- Rebuild of same version: version `0.1.0`, build `2`
- First hotfix release: version `0.1.1`, build `3`

## Release Checklist

Before each production release:

1. Confirm the target version number.
2. Update `CHANGELOG.md`.
3. Verify Supabase migrations needed for the release are applied.
4. Smoke test activation, community onboarding, and login.
5. Verify community feature flags still behave correctly.
6. Tag the release in Git if you want release history later.

## Current Recommendation

For the work already being prepared now:

- keep the current baseline as `0.1.0`
- if you ship the recent fixes separately, release `0.1.1`
- if you wait and combine multiple improvements, target `0.2.0`
