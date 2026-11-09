# BEDROCK F03 — Resident activation credential hardening

Status: isolated implementation prepared; production rollout is not approved.

Base: `master` at `b17d9a3eb6bf7038914b965e86d4e6cc24a8efd8`
Branch: `security/bedrock-f03-activation-pin-hardening`

## Confirmed findings

The deployed v1 trust boundary is the public database RPC, not the web route or
Console UI. Both `validate_resident_activation_pin_v1(text)` and
`complete_resident_activation_pin_v1(text,text,text)` are executable by `anon`.
An attacker can call them without using the web mediation layer.

The current v1 implementation has four confirmed security weaknesses:

1. Its attempt identifier is `rap_validate:<candidate PIN>` or
   `rap_complete:<candidate PIN>`. Changing the six-digit candidate creates a
   new budget.
2. That identifier persists the plaintext PIN in `security_event_log`.
3. Validation scans pending bcrypt hashes because the six-digit PIN is the only
   lookup input. This cost grows with the pending credential population.
4. Generators use PostgreSQL `random()` and retain the PIN in `visible_code`.

The v1 completion transaction does have useful guarantees: it takes an
advisory transaction lock, locks the credential and queue rows, creates the
identity and marks the PIN used in one statement transaction. Expired and used
credentials are rejected. Those guarantees are preserved and strengthened in
v2.

## Dependency inventory

| Component | Purpose and contract | Caller / permission | Compatibility impact |
| --- | --- | --- | --- |
| `generate_resident_activation_pins_v1` | Batch PIN generation and queue promotion | Console superadmin; historically broad grants plus in-body authorization | Must remain while old callers exist |
| `generate_resident_activation_pins_locked_v1` | Lock-safe Console wrapper | `authenticated`, superadmin in body | Wrapped by v2 to preserve lock order |
| `worker_generate_resident_activation_pin_v1` | One credential for an email campaign | `service_role` only | Wrapped by worker v2 |
| `validate_resident_activation_pin_v1` | PIN-only lookup and resident context | `anon`, `authenticated`, `service_role` | Confirmed mobile and web legacy contract |
| `complete_resident_activation_pin_v1` | Creates Auth/profile/member/house link and consumes PIN | `anon`, `authenticated`, `service_role` | Confirmed mobile and Console legacy contract |
| `features/entry/activation/pinActions.ts` | Console batch preparation | Authenticated superadmin Server Action | Switched to v2 |
| `features/entry/activation/emailActions.ts` | Direct/resend activation invitation | Authenticated superadmin Server Action | Link now carries handle only; PIN remains message content |
| `send-onboarding-email-batch` | Campaign worker generation and email | Service role | Switched to worker v2 |
| `/activate`, validate and complete routes | Browser activation | Public web client via server mediation | Switched to v2 and network rate limits |
| `createUserActions.ts` | Superadmin direct account creation | Authenticated superadmin Server Action | Switched to v2 completion |
| Console / Field WhatsApp handoff | Manual sharing of the exact generated PIN | Human operator | Remains compatible with mobile v1 during transition |
| Mobile `app/activate-account.tsx` | Installed-client validation/completion | External mobile repository, public RPC | Not changed here; blocks immediate v1 removal |
| Email/phone correction RPCs | Revoke pending credentials on identity correction | Authenticated superadmin | Continue to expire the same credential row |

No dedicated resident-PIN expiry sweep was found. v1 and v2 enforce expiry at
validation/completion; contact correction explicitly expires pending rows.

## V2 architecture

Each new credential has two independent components:

- `activation_handle`: random UUID used for indexed lookup and carried in the
  activation link.
- six-digit PIN: generated from `pgcrypto.gen_random_bytes` with rejection
  sampling and stored only as bcrypt.

The URL never contains the PIN. The page asks for the separately delivered
PIN. Activation pages use `no-store`, `no-referrer`, and `noindex` headers.

The credential row owns `failed_attempts`, `max_attempts`, `last_attempt_at`,
and `locked_at`. Validation and completion lock that row before checking or
incrementing the budget. Rotating the candidate PIN therefore consumes the
same budget. Unknown 128-bit handles return the same response and do not create
unbounded audit rows.

The web routes add a second, candidate-independent network budget. Its Redis
key is a keyed HMAC of the trusted network identity and environment; neither
credential component is used in the key. Production fails closed if the
existing Upstash/HMAC rate-limit configuration is unavailable. This layer is
defence in depth: direct RPC callers are still constrained by the opaque handle
and database credential budget.

Security events identify the internal credential row UUID, not the activation
handle or PIN. SQL exception text is not persisted by v2.

Completion locks credential then queue, re-checks state, creates all identity
rows, and changes the credential to `used` in the same PostgreSQL statement
transaction. Concurrent requests therefore produce one success at most.

## Compatibility matrix

| Credential / client | v1 RPC | v2 RPC | Outcome during transition |
| --- | --- | --- | --- |
| Existing v1 credential + installed mobile | Supported | Not applicable (no handle) | Resident can still activate |
| New v2 email + web | Technically discoverable by v1, but web uses v2 | Supported | Hardened path |
| New v2 PIN manually shared to old mobile | Supported temporarily | Mobile update pending | Compatibility retained, with v1 residual risk |
| New v2 credential + updated mobile | Not required | Supported after coordinated mobile release | Target state |
| Used / expired / revoked v2 | Rejected by state | Uniform rejection | Cannot be reused |

Legacy generator writes are normalized back to explicit v1 state (no handle and
no inherited v2 lock counter), preventing a hybrid credential if an older
worker or Console version runs during the transition. V2 wrappers then upgrade
that transient write within the same transaction.

## Rollout gates

1. Merge/deploy database additions first only after security review. Do not
   revoke v1.
2. Deploy Console/web/worker consumers together with the migration.
3. Release mobile support for `activation_id + PIN`, and measure only aggregate
   v1/v2 call counts—never credential values.
4. Stop generating credentials intended for v1-only clients.
5. After the supported mobile adoption window, revoke `anon` and
   `authenticated` execution on v1 validation/completion in a separate,
   explicitly approved migration.
6. Retain historical security events under existing retention controls. Do not
   delete production history; restrict access and treat legacy identifiers as
   sensitive credential data.

Rollback before step 5 is application-only: point web/worker callers back to
v1. The additive columns and functions can remain dormant. Do not drop columns
or rewrite historical rows during an incident rollback. After v1 revocation,
rollback requires an explicit security decision because re-granting v1
reintroduces the confirmed exposure.

## Verification

The disposable PostgreSQL 17 fixture proves:

- cryptographic generation and no `visible_code` for v2;
- five different candidate PINs consume one credential budget;
- uniform unknown, locked, expired, revoked, and replay responses;
- audit records contain neither handle nor PIN;
- one successful completion creates exactly one identity graph;
- two concurrent completion sessions result in one success and one rejection;
- v1 grants remain available for the compatibility window;
- v2 generator/helper grants are restricted.

Commands:

```powershell
psql -v ON_ERROR_STOP=1 -f supabase/tests/fixtures/bedrock-f03-activation-v2-schema.sql
psql -v ON_ERROR_STOP=1 -f supabase/migrations/20261031010000_bedrock_f03_activation_credential_v2.sql
psql -v ON_ERROR_STOP=1 -f supabase/tests/bedrock-f03-activation-v2.sql
powershell -File supabase/tests/run-bedrock-f03-concurrency.ps1
node --test tests/bedrock-f03-activation-v2.test.mjs
```

## Residual risks and decisions

- P0 residual: v1 public RPCs keep their candidate-derived budget and legacy
  logging until mobile migration is complete. This branch deliberately does
  not pretend otherwise.
- The exact mobile repository/version inventory is not present in this Git
  context. Its v2 implementation and adoption telemetry are release gates.
- Historical `security_event_log.identifier` values may contain old PINs.
  Production values were not queried or exported. Retention/access remediation
  needs a separately approved operational plan.
- The existing rate-limit secret and Redis service must be confirmed in each
  production environment without exposing their values.

Verdict: suitable for Draft security review and isolated integration testing;
not approved for merge, deployment, v1 revocation, or production migration.
