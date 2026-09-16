import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("ENTRY customer profiles use a separate contacts model with one primary contact", () => {
  const migration = read(
    "supabase/migrations/20260916010000_entry_customer_profiles.sql",
  );

  assert.match(migration, /create table if not exists public\.entry_customer_profiles/);
  assert.match(migration, /create table if not exists public\.entry_customer_contacts/);
  assert.match(migration, /community_id uuid not null references public\.communities\(id\) on delete restrict/);
  assert.match(migration, /entry_customer_profiles_community_unique/);
  assert.match(migration, /status in \('active', 'inactive'\)/);
  assert.match(migration, /entry_customer_contacts_one_primary/);
  assert.match(migration, /exactly_one_primary_contact_required/);
  assert.match(migration, /entry_customer_requires_exactly_one_primary_contact/);
  assert.match(migration, /deferrable initially deferred/);
  assert.doesNotMatch(migration.toLowerCase(), /seshat/);
});

test("customer profile tables are not directly mutable by authenticated users", () => {
  const migration = read(
    "supabase/migrations/20260916010000_entry_customer_profiles.sql",
  );

  assert.match(migration, /alter table public\.entry_customer_profiles enable row level security/);
  assert.match(migration, /alter table public\.entry_customer_contacts enable row level security/);
  assert.match(migration, /revoke all on table public\.entry_customer_profiles from authenticated/);
  assert.match(migration, /revoke all on table public\.entry_customer_contacts from authenticated/);
  assert.match(migration, /grant select on table public\.entry_customer_profiles to authenticated/);
  assert.match(migration, /grant select on table public\.entry_customer_contacts to authenticated/);
  assert.doesNotMatch(migration, /grant\s+(insert|update|delete)/i);
  assert.match(migration, /using \(public\.is_superadmin\(\)\)/);
});

test("customer profile RPC is security-definer and superadmin-gated", () => {
  const migration = read(
    "supabase/migrations/20260916010000_entry_customer_profiles.sql",
  );
  const actions = read("features/entry/customers/actions.ts");

  assert.match(migration, /security definer/);
  assert.match(migration, /set search_path = public/);
  assert.match(migration, /if not public\.is_superadmin\(\) then/);
  assert.match(migration, /revoke all on function public\.upsert_entry_customer_profile_v1/);
  assert.match(migration, /grant execute on function public\.upsert_entry_customer_profile_v1/);
  assert.match(actions, /await requireSuperadmin\(\)/);
  assert.match(actions, /getEntryPreviewReadOnlyError/);
});

test("ENTRY customers are reachable from navigation and route pages", () => {
  const sidebar = read("components/layout/AppSidebar.tsx");
  const listPage = read("app/(console)/products/entry/customers/page.tsx");
  const newPage = read("app/(console)/products/entry/customers/new/page.tsx");
  const detailPage = read(
    "app/(console)/products/entry/customers/[customerId]/page.tsx",
  );

  assert.match(sidebar, /Customers/);
  assert.match(sidebar, /\/products\/entry\/customers/);
  assert.match(listPage, /New customer/);
  assert.match(newPage, /CustomerForm/);
  assert.match(detailPage, /Edit customer info/);
  assert.doesNotMatch(detailPage, /Connect to Seshat/);
});

test("additional contacts are opt-in from the customer form", () => {
  const form = read("features/entry/customers/CustomerForm.tsx");

  assert.match(form, /Add another contact/);
  assert.match(form, /additional_contacts_json/);
  assert.match(form, /removeAdditionalContact/);
  assert.doesNotMatch(form, /Secondary contact/);
});

test("community detail routes to view or create the related customer profile", () => {
  const communityDetail = read(
    "app/(console)/products/entry/communities/[communityId]/page.tsx",
  );

  assert.match(communityDetail, /getCustomerProfileForCommunity/);
  assert.match(communityDetail, /View customer profile/);
  assert.match(communityDetail, /Create customer profile/);
  assert.match(communityDetail, /\/products\/entry\/customers\/new\?community_id=\$\{community\.id\}/);
});
