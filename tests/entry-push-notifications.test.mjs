import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const migration = read("supabase/migrations/20260910020000_entry_ticket_push_notifications.sql");
const server = read("features/entry/push/server.ts");
const control = read("features/entry/push/EntryPushControl.tsx");
const signOut = read("features/entry/push/EntryPushSignOutForm.tsx");
const authActions = read("features/auth/actions.ts");
const worker = read("public/minerva-entry-push-sw.js");
const dispatchRoute = read("app/api/entry/push/dispatch/route.ts");
const subscriptionsRoute = read("app/api/entry/push/subscriptions/route.ts");
const middleware = read("lib/supabase/middleware.ts");
const consoleTickets = read("app/(console)/products/entry/tickets/page.tsx");
const fieldTickets = read("app/(field)/field/entry/tickets/page.tsx");
const nextConfig = read("next.config.ts");
const packageJson = JSON.parse(read("package.json"));
const packageLock = read("package-lock.json");

test("Web Push uses one active browser endpoint owner and current authorization", () => {
  assert.match(migration, /unique index[\s\S]*entry_web_push_subscriptions_active_endpoint_uidx[\s\S]*where is_active = true/i);
  assert.match(migration, /pg_advisory_xact_lock\(hashtext\(v_endpoint\)\)/);
  assert.match(migration, /s\.user_id <> p_user_id/);
  assert.match(migration, /not public\.is_superadmin\(s\.user_id\)/);
  assert.match(migration, /public\.is_superadmin\(s\.user_id\)[\s\S]*for update of d skip locked/i);

  assert.match(server, /checkSubscriptionAuthorization/);
  assert.match(server, /rpc\(\s*"is_superadmin"/);
  assert.match(server, /Re-check authorization immediately before contacting the push provider/);
  assert.match(server, /authorization === "revoked" \? "pruned" : "retry"/);
});

test("subscription API trusts authenticated server identity instead of client identity", () => {
  assert.match(subscriptionsRoute, /getEntryPushApiUser\(\)/);
  assert.match(subscriptionsRoute, /userId: auth\.user\.id/);
  assert.doesNotMatch(subscriptionsRoute, /body\.(userId|user_id|role|communityId|community_id|tenant)/);
  assert.match(server, /upsert_entry_web_push_subscription_v1/);
  assert.match(migration, /revoke all on table public\.entry_web_push_subscriptions from public, anon, authenticated/);
  assert.match(migration, /grant select, insert, update, delete on table public\.entry_web_push_subscriptions to service_role/);
});

test("ticket and incoming-user-message triggers enqueue idempotently while staff replies stay silent", () => {
  assert.match(migration, /after insert on public\.support_tickets/);
  assert.match(migration, /'ticket_created'/);
  assert.match(migration, /after insert on public\.support_ticket_messages/);
  assert.match(migration, /lower\(coalesce\(new\.author_type, ''\)\) <> 'user'/);
  assert.match(migration, /'incoming_message'/);
  assert.match(migration, /unique \(source_table, source_id, event_type\)/);
});

test("durable queue is concurrency-safe, bounded and recovers stale claims", () => {
  assert.match(migration, /for update skip locked/i);
  assert.match(migration, /for update of d skip locked/i);
  assert.match(migration, /interval '15 minutes'/);
  assert.match(migration, /attempts between 0 and 8/);
  assert.match(migration, /d\.attempts < 8/);
  assert.match(migration, /p_retry_after_seconds/);
  assert.match(server, /Math\.min\(60 \* 2 \*\* exponent, 3600\)/);
  assert.match(server, /status === 404 \|\| status === 410/);
  assert.match(server, /status === 429/);
});

test("enable, disable and sign-out lifecycle cannot leak a browser subscription across accounts", () => {
  assert.match(control, /Notification\.requestPermission\(\)/);
  assert.match(control, /userVisibleOnly: true/);
  assert.match(control, /saveSubscription\(subscription, surface\)/);
  assert.match(control, /Promise\.allSettled\(\[/);
  assert.match(control, /subscription\.unsubscribe\(\)/);
  assert.match(control, /method: "DELETE"/);
  assert.match(control, /registration\.update\(\)/);
  assert.match(control, /navigator\.serviceWorker\.ready/);

  assert.match(signOut, /keepalive: true/);
  assert.match(signOut, /Promise\.race\(\[/);
  assert.match(signOut, /setTimeout\(resolve, 650\)/);
  assert.match(signOut, /finally[\s\S]*form\.requestSubmit\(\)/);
  assert.match(authActions, /bestEffortDeactivateEntryPushSubscription/);
  assert.match(authActions, /await supabase\.auth\.signOut\(\{ scope: "local" \}\)/);
});

test("service worker only opens same-origin ENTRY ticket UUID routes", () => {
  assert.match(worker, /ENTRY_TICKET_PATH/);
  assert.ok(worker.includes("products\\/entry\\/tickets|field\\/entry\\/tickets"));
  assert.match(worker, /url\.origin !== self\.location\.origin/);
  assert.match(worker, /if \(url\.search \|\| url\.hash\) return null/);
  assert.match(worker, /clients\.matchAll/);
  assert.match(worker, /clients\.openWindow\(targetPath\)/);
  assert.doesNotMatch(worker, /openWindow\(payload\.url\)/);
});

test("service worker always displays a privacy-safe notification when Android push data is missing", () => {
  assert.match(worker, /self\.skipWaiting\(\)/);
  assert.match(worker, /self\.clients\.claim\(\)/);
  assert.match(worker, /A userVisibleOnly PushSubscription must result in a visible notification/);
  assert.doesNotMatch(worker, /if \(!event\.data\) return/);
  assert.doesNotMatch(worker, /if \(!url\) return/);
  assert.match(worker, /ENTRY support/);
  assert.match(worker, /A support ticket needs attention\./);
  assert.match(worker, /if \(url\) options\.data = \{ url \}/);
  assert.match(worker, /await self\.registration\.showNotification\(title, options\)/);
});

test("push payload stays minimal and ticket authorization remains on existing protected routes", () => {
  assert.match(server, /title: `ENTRY · \$\{delivery\.ticketNumber\}`/);
  assert.match(server, /New support ticket received\./);
  assert.match(server, /New reply received on a support ticket\./);
  assert.doesNotMatch(server, /requester(Name|Email)|resident.*email|description.*buildPayload|phone.*buildPayload/i);
  assert.match(consoleTickets, /EntryPushControl surface="console"/);
  assert.match(fieldTickets, /EntryPushControl surface="field"/);
});

test("machine dispatcher reaches its own Bearer-secret boundary without becoming session-public", () => {
  assert.match(
    middleware,
    /pathname === "\/api\/entry\/push\/dispatch"[\s\S]*protectMachineAuthenticatedResponse\(NextResponse\.next\(\{ request \}\)\)/,
  );
  assert.match(dispatchRoute, /ENTRY_WEB_PUSH_DISPATCH_SECRET/);
  assert.match(dispatchRoute, /dispatchSecretMatches\(request\)/);
  assert.match(dispatchRoute, /return json\(\{ error: "Unauthorized" \}, 401\)/);
  assert.doesNotMatch(middleware, /pathname\.startsWith\("\/api\/entry\/push\/"\)/);
});

test("dispatcher is secret-protected and scheduling is opt-in through pg_cron + pg_net + Vault", () => {
  assert.match(dispatchRoute, /dispatchSecretMatches\(request\)/);
  assert.match(dispatchRoute, /ENTRY_WEB_PUSH_DISPATCH_SECRET/);
  assert.match(server, /timingSafeEqual/);
  assert.match(migration, /vault\.decrypted_secrets/);
  assert.match(migration, /entry_web_push_dispatch_url/);
  assert.match(migration, /entry_web_push_dispatch_secret/);
  assert.match(migration, /net\.http_post/);
  assert.match(migration, /cron\.schedule/);
  assert.match(migration, /install_entry_web_push_dispatch_schedule_v1/);

  // The migration defines the installer but never executes it at top level.
  assert.doesNotMatch(
    migration,
    /^\s*(?:select|perform)\s+(?:public\.)?install_entry_web_push_dispatch_schedule_v1\s*\(/im,
  );
});

test("worker cache headers and dependency lock are production reproducible", () => {
  assert.equal(packageJson.dependencies["web-push"], "3.6.7");
  assert.match(packageLock, /"web-push": "3\.6\.7"/);
  assert.match(packageLock, /node_modules\/web-push/);
  assert.match(nextConfig, /source: "\/minerva-entry-push-sw\.js"/);
  assert.match(nextConfig, /Service-Worker-Allowed/);
  assert.match(nextConfig, /must-revalidate/);
});

test("Web Push delivery remains in the Node dispatcher, not a duplicate Supabase Edge Function", () => {
  assert.equal(
    fs.existsSync(path.join(root, "supabase/functions/entry-web-push")),
    false,
  );
  assert.match(server, /webpush\.sendNotification/);
  assert.match(migration, /\/api\/entry\/push\/dispatch/);
});
