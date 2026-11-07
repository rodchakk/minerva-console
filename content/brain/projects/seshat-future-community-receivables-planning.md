# Seshat — Future Community Receivables / Unit Ledger Planning

## Status

- **Type:** Future product/accounting planning note
- **Captured:** 2026-09-04
- **Status:** Approved for future consideration; **not an active implementation mission**
- **Related:** `PRJ-0002` (Seshat), ENTRY community operations

## Why this is being captured

Seshat's current priority remains Minerva's own internal financial operation for its two current operators. However, if Seshat later supports ENTRY communities or patronatos, resident/unit payment status will need more fidelity than a single `paid / unpaid` flag or a mutable `balance_due` field.

This note preserves the accounting model to consider when that stage becomes real so it is not rediscovered from scratch later.

## Core model to consider

Treat each residential unit (house, apartment, workshop, commercial unit, etc.) as having a **receivables ledger / current account** composed of auditable movements.

Examples of movements:

- recurring monthly charge / assessment;
- one-time charge;
- payment received;
- late fee or penalty;
- credit;
- waiver / exemption;
- correction or other explicit adjustment.

The balance should be **derived from the ledger**, not stored as the only source of truth. In other words, do not model the system as merely `Casa 12 owes L3,000`; preserve the transactions that explain why the unit owes that amount.

## Payment allocation behavior

When a payment is received, Seshat should be able to allocate it to specific outstanding charges.

A reasonable default for future evaluation is **oldest due first (FIFO)**, while preserving the ability to support explicit/manual allocation if real patronato workflows require it.

Example:

- January charge: L1,500
- February charge: L1,500
- Payment received: L3,000
- Allocation: January L1,500 + February L1,500

Partial payments must also be representable without losing auditability.

## Balances ahead and behind

The future model should naturally handle both arrears and prepaid balances:

- positive outstanding amount -> amount due / arrears;
- zero -> current / paid up;
- credit balance -> amount in favor / prepaid position.

A resident may therefore be one or more periods behind, partially paid, fully current, or one or more periods ahead without special-case flags being the accounting source of truth.

## Useful future derived views

If/when this feature is implemented, Seshat should be able to derive operational views such as:

- current / al día;
- one period overdue;
- two to three periods overdue;
- 90+ days overdue;
- partial payment;
- credit / balance in favor;
- total amount overdue;
- oldest unpaid due date / aging;
- charge-by-charge and payment-by-payment history for a unit.

These are **views derived from the ledger**, not independent balances maintained separately.

## Important design principles for the future mission

1. **Ledger first, status second.** Store charges, payments, credits, fees, waivers, and adjustments as auditable records; calculate status from them.
2. **Never lose the explanation of a balance.** The system should always be able to answer what created a debt or credit.
3. **Support real-world irregularity.** Partial payments, multi-month payments, advance payments, late fees, exemptions, and corrections must not require destructive edits to history.
4. **Avoid double counting.** Payment allocation and accounting recognition need a clear contract so one payment cannot accidentally satisfy the same charge twice.
5. **Keep financial history immutable where practical.** Corrections should prefer explicit reversing/adjusting entries over silently rewriting historical transactions when the accounting model is implemented.
6. **Do not implement prematurely.** Validate this model against real patronato/community workflows before choosing schema, allocation rules, aging definitions, or UI.

## Scope boundary

This capture does **not** approve or implement:

- community billing in Seshat today;
- recurring patronato charge generation;
- late-fee policy;
- collections workflows;
- notifications;
- resident-facing payment screens;
- a specific database schema;
- FIFO as a permanently fixed business rule.

Those belong to a future reviewed mission if Seshat actually reaches community financial operations.

## Future mission trigger

Revisit this note when Seshat begins designing any of the following:

- patronato/community accounting;
- per-unit dues or maintenance fees;
- resident payment tracking;
- arrears / aging reports;
- advance payments / balances in favor;
- payment proof reconciliation.

At that point, use this ledger model as the starting hypothesis and validate it against the real customer's operating rules before implementation.
