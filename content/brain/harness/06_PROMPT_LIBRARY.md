# 06 — Prompt Library

Versioned prompts that Minerva runs against AI models. The machine-readable list is `content/brain/registries/prompts.json`. Long-form prompt bodies live in `content/brain/prompts/`.

## Conventions

- IDs: `MCB-NNNN` for Minerva Core Brain missions; product-specific prompts use their own prefix.
- `version` is a free-form label (`v1`, `2026-06-16`, etc.). Never rewrite history; bump the version.
- `status` is one of `draft`, `approved`, or `archived`.
- A prompt is approved only after a human review.

## Seeded prompts

| ID | Version | Title | Status |
|---|---|---|---|
| MCB-0001 | v1 | Brain Placement & Architecture Recon | approved |
| MCB-0002 | v1 | Create Brain Harness and Static Shell | approved |

Full bodies live next to this file in `content/brain/prompts/`.
