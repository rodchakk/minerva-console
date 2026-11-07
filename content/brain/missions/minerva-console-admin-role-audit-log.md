# Minerva Console — Admin Role Activity Audit

**Status:** Captured / pending design  
**Date:** 2026-09-05  
**Product:** Minerva Console + ENTRY  
**Area:** Audit / Community Administration / Security / Operations

## Idea

Minerva Console should make administrator-role changes visible and attributable.

Minerva must be able to answer questions such as:

- Who created a new community administrator?
- Who promoted an existing user to ADMIN?
- Who removed ADMIN privileges from a user?
- When did the change happen?
- In which community did it happen?
- What was the user's previous role/state and what did it become?

This should not rely on reconstructing history from the current membership row after the fact. The action itself should be captured as an auditable event.

## Minimum event types

At minimum capture:

- `ADMIN_CREATED`
- `USER_PROMOTED_TO_ADMIN`
- `ADMIN_ROLE_REMOVED`

If the implementation model treats create/promotion as the same membership-role mutation, the underlying event taxonomy can differ, but the Console must present the human meaning clearly.

## Minimum audit payload

Each event should preserve enough immutable context to identify:

- actor user ID
- actor display name / email snapshot when appropriate
- target user ID
- target display name / email snapshot when appropriate
- community ID
- community name snapshot when appropriate
- previous role / previous admin state
- new role / new admin state
- timestamp
- source/channel if useful (`ADMIN_MOBILE`, `MINERVA_CONSOLE`, backend/admin tool, etc.)
- correlation/request ID if available for troubleshooting

Do not expose secrets or raw auth tokens.

## Minerva Console UX direction

Provide an operator-facing activity/audit surface where Minerva can filter and inspect these events.

Useful filters:

- community
- actor
- target user
- event type
- date range

Human-readable examples:

- `Carlos Mendoza promovió a Ana López a Administrador — Residencial Paraíso — 5 Sep 2026, 3:42 PM`
- `Ana López retiró permisos de Administrador a José Rivera — Residencial Paraíso — 5 Sep 2026, 4:10 PM`

The purpose is operational accountability, support investigation and security review — not just analytics.

## Product rule

Role changes affecting community administration are security-sensitive actions and should be audit-visible to Minerva even when the change is allowed and successful.

Prefer append-only audit records or equivalent immutable event history. Do not overwrite prior events when the same user changes role multiple times.

## Future extension

This audit model can later expand to other high-value administrative actions such as:

- unit deactivate/reactivate
- guard creation/deactivation
- resident deactivation
- recovery-code generation
- community configuration changes
- destination changes

But the first explicit requirement is **administrator creation, promotion and removal**.