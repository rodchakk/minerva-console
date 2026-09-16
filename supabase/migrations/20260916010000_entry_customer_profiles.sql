-- ENTRY customer profiles.
-- Manual internal customer directory for Minerva staff. This intentionally does
-- not integrate with finance systems, invoices, or automated customer creation.

create table if not exists public.entry_customer_profiles (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete restrict,
  customer_name text not null,
  status text not null default 'active',
  contract_date date,
  billing_contact_name text,
  billing_email text,
  billing_preferred_channel text,
  billing_notes text,
  legal_name text,
  tax_id text,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint entry_customer_profiles_status_check
    check (status in ('active', 'inactive')),
  constraint entry_customer_profiles_billing_channel_check
    check (
      billing_preferred_channel is null
      or billing_preferred_channel in ('email', 'whatsapp', 'other')
    ),
  constraint entry_customer_profiles_customer_name_check
    check (length(btrim(customer_name)) > 0)
);

create table if not exists public.entry_customer_contacts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.entry_customer_profiles(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  role text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint entry_customer_contacts_name_check
    check (length(btrim(name)) > 0)
);

create unique index if not exists entry_customer_profiles_community_unique
  on public.entry_customer_profiles (community_id);

create index if not exists entry_customer_profiles_status_updated_idx
  on public.entry_customer_profiles (status, updated_at desc);

create index if not exists entry_customer_profiles_customer_name_idx
  on public.entry_customer_profiles (lower(customer_name));

create index if not exists entry_customer_contacts_customer_idx
  on public.entry_customer_contacts (customer_id, is_primary desc, created_at asc);

create unique index if not exists entry_customer_contacts_one_primary
  on public.entry_customer_contacts (customer_id)
  where is_primary;

create or replace function public.enforce_entry_customer_primary_contact_v1()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_customer_id uuid;
  v_customer_ids uuid[];
  v_primary_count integer;
begin
  if TG_TABLE_NAME = 'entry_customer_profiles' then
    v_customer_ids := array[new.id];
  elsif TG_OP = 'INSERT' then
    v_customer_ids := array[new.customer_id];
  elsif TG_OP = 'DELETE' then
    v_customer_ids := array[old.customer_id];
  elsif TG_OP = 'UPDATE' then
    v_customer_ids := array[old.customer_id, new.customer_id];
  else
    v_customer_ids := array[]::uuid[];
  end if;

  foreach v_customer_id in array v_customer_ids loop
    if v_customer_id is null then
      continue;
    end if;

    if not exists (
      select 1
      from public.entry_customer_profiles p
      where p.id = v_customer_id
    ) then
      continue;
    end if;

    select count(*)
      into v_primary_count
    from public.entry_customer_contacts c
    where c.customer_id = v_customer_id
      and c.is_primary;

    if v_primary_count <> 1 then
      raise exception 'entry_customer_requires_exactly_one_primary_contact';
    end if;
  end loop;

  if TG_OP = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_entry_customer_profiles_primary_contact
  on public.entry_customer_profiles;
create constraint trigger enforce_entry_customer_profiles_primary_contact
after insert or update on public.entry_customer_profiles
deferrable initially deferred
for each row
execute function public.enforce_entry_customer_primary_contact_v1();

drop trigger if exists enforce_entry_customer_contacts_primary_contact
  on public.entry_customer_contacts;
create constraint trigger enforce_entry_customer_contacts_primary_contact
after insert or update or delete on public.entry_customer_contacts
deferrable initially deferred
for each row
execute function public.enforce_entry_customer_primary_contact_v1();

create or replace function public.set_entry_customer_profiles_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_entry_customer_profiles_updated_at
  on public.entry_customer_profiles;
create trigger set_entry_customer_profiles_updated_at
before update on public.entry_customer_profiles
for each row
execute function public.set_entry_customer_profiles_updated_at();

drop trigger if exists set_entry_customer_contacts_updated_at
  on public.entry_customer_contacts;
create trigger set_entry_customer_contacts_updated_at
before update on public.entry_customer_contacts
for each row
execute function public.set_entry_customer_profiles_updated_at();

alter table public.entry_customer_profiles enable row level security;
alter table public.entry_customer_contacts enable row level security;

revoke all on table public.entry_customer_profiles from anon;
revoke all on table public.entry_customer_contacts from anon;
revoke all on table public.entry_customer_profiles from authenticated;
revoke all on table public.entry_customer_contacts from authenticated;

grant select on table public.entry_customer_profiles to authenticated;
grant select on table public.entry_customer_contacts to authenticated;

drop policy if exists entry_customer_profiles_superadmin_select
  on public.entry_customer_profiles;
create policy entry_customer_profiles_superadmin_select
  on public.entry_customer_profiles
  for select
  to authenticated
  using (public.is_superadmin());

drop policy if exists entry_customer_contacts_superadmin_select
  on public.entry_customer_contacts;
create policy entry_customer_contacts_superadmin_select
  on public.entry_customer_contacts
  for select
  to authenticated
  using (
    public.is_superadmin()
    and exists (
      select 1
      from public.entry_customer_profiles p
      where p.id = entry_customer_contacts.customer_id
    )
  );

create or replace function public.upsert_entry_customer_profile_v1(
  p_customer_id uuid,
  p_community_id uuid,
  p_customer_name text,
  p_status text,
  p_contract_date date,
  p_billing_contact_name text,
  p_billing_email text,
  p_billing_preferred_channel text,
  p_billing_notes text,
  p_legal_name text,
  p_tax_id text,
  p_internal_notes text,
  p_contacts jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
  v_contacts jsonb := coalesce(p_contacts, '[]'::jsonb);
  v_primary_count integer;
  v_contact_count integer;
begin
  if not public.is_superadmin() then
    raise exception 'not_authorized';
  end if;

  if p_community_id is null then
    raise exception 'community_required';
  end if;

  if not exists (select 1 from public.communities where id = p_community_id) then
    raise exception 'community_not_found';
  end if;

  if length(btrim(coalesce(p_customer_name, ''))) = 0 then
    raise exception 'customer_name_required';
  end if;

  if coalesce(p_status, '') not in ('active', 'inactive') then
    raise exception 'invalid_status';
  end if;

  if p_billing_preferred_channel is not null
    and p_billing_preferred_channel not in ('email', 'whatsapp', 'other') then
    raise exception 'invalid_billing_channel';
  end if;

  if jsonb_typeof(v_contacts) <> 'array' then
    raise exception 'contacts_must_be_array';
  end if;

  select count(*)
    into v_contact_count
  from jsonb_array_elements(v_contacts) contact
  where length(btrim(coalesce(contact->>'name', ''))) > 0;

  select count(*)
    into v_primary_count
  from jsonb_array_elements(v_contacts) contact
  where coalesce((contact->>'is_primary')::boolean, false)
    and length(btrim(coalesce(contact->>'name', ''))) > 0;

  if v_contact_count = 0 then
    raise exception 'primary_contact_required';
  end if;

  if v_primary_count <> 1 then
    raise exception 'exactly_one_primary_contact_required';
  end if;

  if p_customer_id is null then
    insert into public.entry_customer_profiles (
      community_id,
      customer_name,
      status,
      contract_date,
      billing_contact_name,
      billing_email,
      billing_preferred_channel,
      billing_notes,
      legal_name,
      tax_id,
      internal_notes
    )
    values (
      p_community_id,
      btrim(p_customer_name),
      p_status,
      p_contract_date,
      nullif(btrim(coalesce(p_billing_contact_name, '')), ''),
      nullif(btrim(coalesce(p_billing_email, '')), ''),
      p_billing_preferred_channel,
      nullif(btrim(coalesce(p_billing_notes, '')), ''),
      nullif(btrim(coalesce(p_legal_name, '')), ''),
      nullif(btrim(coalesce(p_tax_id, '')), ''),
      nullif(btrim(coalesce(p_internal_notes, '')), '')
    )
    returning id into v_customer_id;
  else
    update public.entry_customer_profiles
       set community_id = p_community_id,
           customer_name = btrim(p_customer_name),
           status = p_status,
           contract_date = p_contract_date,
           billing_contact_name = nullif(btrim(coalesce(p_billing_contact_name, '')), ''),
           billing_email = nullif(btrim(coalesce(p_billing_email, '')), ''),
           billing_preferred_channel = p_billing_preferred_channel,
           billing_notes = nullif(btrim(coalesce(p_billing_notes, '')), ''),
           legal_name = nullif(btrim(coalesce(p_legal_name, '')), ''),
           tax_id = nullif(btrim(coalesce(p_tax_id, '')), ''),
           internal_notes = nullif(btrim(coalesce(p_internal_notes, '')), '')
     where id = p_customer_id
     returning id into v_customer_id;

    if v_customer_id is null then
      raise exception 'customer_not_found';
    end if;

    delete from public.entry_customer_contacts
     where customer_id = v_customer_id;
  end if;

  insert into public.entry_customer_contacts (
    customer_id,
    name,
    phone,
    email,
    role,
    is_primary
  )
  select
    v_customer_id,
    btrim(contact->>'name'),
    nullif(btrim(coalesce(contact->>'phone', '')), ''),
    nullif(btrim(coalesce(contact->>'email', '')), ''),
    nullif(btrim(coalesce(contact->>'role', '')), ''),
    coalesce((contact->>'is_primary')::boolean, false)
  from jsonb_array_elements(v_contacts) contact
  where length(btrim(coalesce(contact->>'name', ''))) > 0;

  return v_customer_id;
end;
$$;

revoke all on function public.upsert_entry_customer_profile_v1(
  uuid,
  uuid,
  text,
  text,
  date,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb
) from public;
grant execute on function public.upsert_entry_customer_profile_v1(
  uuid,
  uuid,
  text,
  text,
  date,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb
) to authenticated;

comment on table public.entry_customer_profiles is
  'Manual ENTRY customer profiles maintained by Minerva staff. Canonical home for customer administrative, billing, legal, and internal notes.';

comment on table public.entry_customer_contacts is
  'Contacts for ENTRY customer profiles. Exactly one primary contact is required by the save RPC; additional contacts are optional.';
