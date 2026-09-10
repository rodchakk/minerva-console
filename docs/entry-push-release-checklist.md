# ENTRY Web Push release checklist

This checklist is intentionally separate from implementation. Completing the code PR does not itself activate production Web Push.

## Before merge

- [ ] `npm ci` succeeds from the committed lockfile in CI.
- [ ] ENTRY Web Push focused regressions pass.
- [ ] TypeScript passes.
- [ ] Next.js production build passes.
- [ ] Vercel Preview reaches READY.
- [ ] Review confirms no VAPID private key, dispatch secret, PushSubscription endpoint, or encryption key is committed.
- [ ] Migration has not been applied to production.
- [ ] Production VAPID/dispatch secrets have not been configured prematurely.
- [ ] Cron installer has not been invoked.

## Release after explicit approval

- [ ] Merge only after `MERGE APPROVED`.
- [ ] Apply `20260910020000_entry_ticket_push_notifications.sql`.
- [ ] Configure the documented Vercel environment variables.
- [ ] Configure the documented Supabase Vault values.
- [ ] Install `entry-web-push-dispatch` cron only after both sides share the same dispatch secret.
- [ ] Verify automatic dispatch and queue drain.
- [ ] Complete the manual E2E matrix in `docs/entry-push-notifications.md`.

## Stop condition

If any authorization, account-switch, logout, duplicate-delivery, or arbitrary-navigation test fails, stop the release and remove the cron schedule before investigating.
