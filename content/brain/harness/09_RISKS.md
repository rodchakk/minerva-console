# 09 — Risks

Known risks for Brain. Each lists a mitigation. Update as conditions change.

## R1 — Coupling drift

Brain code accidentally reaches into ENTRY data or feature modules and erodes the separation.

**Mitigation.** Hard rule in `05_AGENT_RULES.md`. The loader seam is the only reader of `content/brain/`. PR review checks for `features/entry` imports in any Brain file.

## R2 — Orphan vault

Brain content is authored but nobody opens the Brain UI, so it dies as a Markdown graveyard.

**Mitigation.** UI shipped in MCB-0002 alongside the content tree. Overview lists counts so emptiness is visible. The next mission should land at least one practical workflow that pulls people into Brain regularly.

## R3 — Inbox becomes the knowledge

Raw AI outputs sit in `inbox/` and start being treated as authoritative.

**Mitigation.** Inbox UI is labeled "raw / unprocessed / not yet knowledge." Workflow (`04_WORKFLOW.md`) requires human promotion. Promoted artifacts get their own typed file plus a registry entry; the inbox item is then archived.

## R4 — Content bloat in Git

Inbox transcripts and meeting dumps make the repo heavy.

**Mitigation.** Archive or delete inbox items after promotion. Long binary artifacts do not belong in `content/brain/`.

## R5 — Premature Neon

The team connects Neon "just to have it," adding deps and env vars that v0 does not need.

**Mitigation.** `DEC-0003` is the explicit boundary. Neon work only begins when there is a concrete use that the file layer cannot serve.

## R6 — Dashboard is ENTRY-specific

The post-login home is "ENTRY Operations." As more products and Brain come online, this becomes misleading.

**Mitigation.** Out of scope for MCB-0002. Track as backlog: neutral multi-product landing.

## R7 — Brain UI exposed to non-superadmins

Brain holds internal strategic content. Any auth change could leak it.

**Mitigation.** Brain inherits the superadmin gate from `app/(console)/layout.tsx`. Auth is intentionally untouched by Brain.
