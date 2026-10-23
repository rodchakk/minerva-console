# Changelog

All notable production-facing changes for Minerva Console should be tracked here.

## [Unreleased]

### Added

- Backend enforcement for community feature flags covering frequent access, reservations, and messages.

### Fixed

- Patched Next.js and its image stack for the October 2026 security advisories.
- Updated SheetJS from 0.18.5 to the official vendored 0.20.3 release, preserving workbook import/export APIs.
- Updated affected transitive dependencies and selected patched Node 24 for development and CI.

- Resident PIN activation now stores a profile auth type compatible with the current Supabase schema.

## [0.1.0] - 2026-05-17

### Baseline

- Established `0.1.0` as the first production baseline for this console release line.
- Defined versioning rules for future hotfix and feature releases.
