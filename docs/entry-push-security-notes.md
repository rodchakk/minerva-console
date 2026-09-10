# ENTRY Web Push security invariants

- Browser subscription ownership is server-session bound; client identity fields are ignored.
- Only one active Minerva owner may exist for the same PushSubscription endpoint.
- Current superadmin authorization is enforced at subscription, fan-out, delivery claim, and immediately before provider send.
- Logout attempts Push cleanup but Push failure cannot block authentication logout.
- Browser notification payloads do not contain resident contact data or full ticket/message text.
- The service worker only opens same-origin protected ENTRY ticket UUID routes.
- Web Push queue tables have RLS enabled and no anon/authenticated table grants.
- Dispatcher access requires a server-side Bearer secret compared in constant time.
- Scheduler credentials are loaded from Supabase Vault and are not committed in SQL.
- `pg_cron` only wakes the Node/Vercel dispatcher; Web Push provider delivery is implemented in one place.
