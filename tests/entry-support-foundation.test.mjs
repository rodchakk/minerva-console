import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const migrationPath =
  "supabase/migrations/20260910230000_entry_support_inbox_foundation.sql";

function read(path) {
  return readFileSync(path, "utf8");
}

test("support foundation keeps Waiting on user backward-compatible with existing clients", () => {
  const migration = read(migrationPath);

  assert.match(
    migration,
    /add column if not exists waiting_on_user boolean not null default false/,
  );
  assert.match(
    migration,
    /when v_state = 'resolved' then 'resolved'[\s\S]*else 'in_progress'/,
  );
  assert.match(
    migration,
    /when t\.status = 'in_progress' and t\.waiting_on_user then 'waiting_user'/,
  );
  assert.match(
    migration,
    /if new\.status <> 'in_progress' then[\s\S]*new\.waiting_on_user := false/,
  );
  assert.doesNotMatch(
    migration,
    /status\s+(?:text|varchar)[\s\S]{0,120}waiting_user/i,
  );
});

test("staff unread state is durable per operator and inaccessible directly", () => {
  const migration = read(migrationPath);

  assert.match(migration, /create table if not exists public\.support_ticket_staff_reads/);
  assert.match(migration, /primary key \(ticket_id, staff_user_id\)/);
  assert.match(migration, /alter table public\.support_ticket_staff_reads enable row level security/);
  assert.match(
    migration,
    /revoke all on table public\.support_ticket_staff_reads from public, anon, authenticated/,
  );
  assert.match(
    migration,
    /from public\.support_tickets t[\s\S]*join public\.superadmin_users sa on sa\.is_active = true[\s\S]*on conflict \(ticket_id, staff_user_id\) do nothing/,
  );
});

test("staff read cursor is superadmin-gated, bounded by user activity, and monotonic", () => {
  const migration = read(migrationPath);

  assert.match(migration, /support_admin_mark_ticket_read_v2/);
  assert.match(migration, /not public\.is_superadmin\(v_user_id\)/);
  assert.match(
    migration,
    /v_effective_read_at := least\([\s\S]*p_read_through,[\s\S]*v_latest_user_activity,[\s\S]*now\(\)/,
  );
  assert.match(
    migration,
    /last_read_at = greatest\(r\.last_read_at, excluded\.last_read_at\)/,
  );
});

test("a requester reply automatically clears Waiting on user", () => {
  const migration = read(migrationPath);

  assert.match(migration, /support_clear_waiting_on_requester_message_v1/);
  assert.match(migration, /when \(new\.author_type = 'user'\)/);
  assert.match(
    migration,
    /update public\.support_tickets[\s\S]*set waiting_on_user = false[\s\S]*where id = new\.ticket_id/,
  );
});

test("v2 inbox exposes attention metadata and orders unread activity first", () => {
  const migration = read(migrationPath);
  const queries = read("features/entry/support/queries.ts");

  assert.match(migration, /support_admin_list_tickets_v2/);
  assert.match(migration, /unread_count bigint/);
  assert.match(migration, /last_user_activity_at timestamptz/);
  assert.match(migration, /last_message_at timestamptz/);
  assert.match(migration, /last_message_author_type text/);
  assert.match(
    migration,
    /when i\.unread_count > 0 then 0[\s\S]*when i\.workflow_state = 'open' then 1[\s\S]*when i\.workflow_state = 'in_progress' then 2[\s\S]*when i\.workflow_state = 'waiting_user' then 3/,
  );
  assert.match(queries, /support_admin_list_tickets_v2/);
  assert.match(queries, /unreadCount/);
  assert.match(queries, /lastMessageAt/);
  assert.match(queries, /lastMessageAuthorType/);
});

test("Console workflow action supports Waiting on user without changing the legacy RPC", () => {
  const actions = read("features/entry/support/actions.ts");
  const detail = read("app/(console)/products/entry/tickets/[ticketId]/page.tsx");

  assert.match(actions, /"waiting_user"/);
  assert.match(actions, /support_admin_update_workflow_v2/);
  assert.match(detail, /defaultValue=\{ticket\.workflowState\}/);
  assert.match(detail, /<option value="waiting_user">Waiting on user<\/option>/);
});

test("Console read acknowledgement only advances when the newest requester activity is visible", () => {
  const conversation = read("features/entry/support/SupportConversation.tsx");

  assert.match(conversation, /markEntrySupportTicketRead/);
  assert.match(conversation, /latestUserActivity/);
  assert.match(conversation, /nearBottomRef\.current/);
  assert.match(conversation, /setHasNewMessages\(true\)/);
  assert.match(conversation, /markLatestAsRead\(\)/);
  assert.match(
    conversation,
    /if \(nearBottomRef\.current\) \{[\s\S]*scrollToLatest\(\);[\s\S]*markLatestAsRead\(\);[\s\S]*return;[\s\S]*\}[\s\S]*setHasNewMessages\(true\)/,
  );
});

test("Console inbox surfaces Nuevos, Waiting on user, unread indicators, and last activity", () => {
  const inbox = read("app/(console)/products/entry/tickets/page.tsx");

  assert.match(inbox, /\{ label: "Nuevos", value: "unread" \}/);
  assert.match(inbox, /\{ label: "Esperando usuario", value: "waiting_user" \}/);
  assert.match(inbox, /function UnreadIndicator/);
  assert.match(inbox, /ticket\.unreadCount/);
  assert.match(inbox, /ticket\.lastMessageAt/);
  assert.match(inbox, />Actividad<\/th>/);
});

test("foundation remains Console-only at the client contract boundary", () => {
  const fieldData = read("features/entry/field/ticketData.ts");
  const fieldActions = read("features/entry/field/ticketActions.ts");

  assert.doesNotMatch(fieldData, /waiting_user|waiting_on_user/);
  assert.doesNotMatch(fieldActions, /waiting_user|waiting_on_user/);
  assert.match(fieldActions, /support_update_status/);
  assert.doesNotMatch(fieldActions, /support_admin_update_workflow_v2/);
});
