# ENTRY — Product Foundation

What ENTRY is, who uses it, the problem it solves, its value proposition, and its modules. Part of the ENTRY Knowledge Pack; see [entry.md](entry.md) for the index.

## Verified from code

### What ENTRY is
ENTRY is a Minerva Technologies mobile app for residential / community access control. Stack: Expo SDK ~54, React Native 0.81, React 19, expo-router 6, TypeScript strict; Supabase backend (Postgres 17, Auth, Edge Functions, Realtime, Storage). Store identity: app name **Entry**, bundle id `com.minervatechnologies.entry`, Expo slug `gatewise`. UI language Spanish; locale Honduras (`America/Tegucigalpa`, currency `HNL`). (`package.json`, `app.json`, harness `01_PROJECT_BRIEF`/`03_ARCHITECTURE`.)

### Roles (users)
Four roles: **Resident**, **Guard**, **Admin**, **SuperAdmin** (`lib/roles.ts`, `providers/AuthProvider.tsx`).

- **Resident** — creates access authorizations for visitors, deliveries, events, recurring staff ("frequent"), and self; reserves community amenities; can trigger a panic/SOS alert.
- **Guard** — validates people at the gate by scanning a QR or typing a PIN, captures evidence photos, registers entry/exit; handles manual (no-credential) entries and SOS alerts.
- **Admin / SuperAdmin** — manage users, invites, reservations, community messages, identity review, recovery/recovery-access.

### Problem it solves
Replaces manual/call-based gate control (a guard phoning a resident to authorize each visitor) with a structured, auditable access system: residents pre-authorize entries that produce a QR/PIN credential, guards resolve that credential on demand and log every check-in/check-out in an immutable audit trail. (`entry_logs` immutable audit; guard pull model — `03_ARCHITECTURE`.)

### Value proposition
- For residents: self-service authorization (incl. by voice), shareable QR/PIN, recurring staff, SOS.
- For guards: fast credential resolution + evidence capture, no manual roster needed.
- For communities/admins: per-community tenancy, identity review, recovery, messaging, amenity reservations, and an immutable entry log.

### Modules (verified from `app/` structure)
- **Auth**: login (username or email), forgot/reset password, account activation, pending/disabled states (`app/(auth)/**`, `app/activate-account.tsx`, `app/reset-password.tsx`).
- **Resident**: visits, deliveries, events, frequent access, self-access, my-access QR, reservations, community messages, SOS waiting, profile, support, **create-voice** (`app/(tabs)/resident/**`).
- **Guard**: scanner, check-in, check-out, manual entry, manual checkouts, guard group, notifications, SOS (`app/(tabs)/guard/**`).
- **Admin**: users, pending invites, create/invite resident, identity review, recovery-access, reservations, community messages, avisos (`app/(tabs)/admin/**`).
- **Cross-cutting libs**: `lib/` — `roles`, `rpcErrorHandler`, `notificationService`, `pushNotifications`, `adminReservations`, `guardUi`, `email`, `supabase`, `voice/`.

## Operator-provided

- ENTRY is the product Rudy intends to keep advancing (commercial focus on residential communities). See [entry-sales-and-leads.md](entry-sales-and-leads.md).

## Inferred

- The "community access intelligence system" framing (beyond a "QR visitor app") is the stated strategic direction; current shipping scope is still the access-pass + guard-resolution core plus the Voice MVP. (Harness `01`/`04`.)

## Unknown / Needs verification

- Production rollout status (how many real communities are live) — not in repo.
- Whether SuperAdmin is a distinct deployment surface vs. an elevated role only.

## Risks

- Product breadth (resident + guard + admin + reservations + messaging + SOS) is large for a small team; focus risk.

## Next actions

- Keep this foundation in sync when ENTRY harness `01_PROJECT_BRIEF` changes.
- Confirm production rollout numbers with operator to make the foundation complete.
