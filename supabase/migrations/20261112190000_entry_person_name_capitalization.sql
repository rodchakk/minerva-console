-- ENTRY display-name capitalization (additive).
-- Search/identity normalization functions (_cr_normalize_name_v1 and
-- _cr_conversion_normalize_name_v1) MUST remain lowercase.
-- This migration handles future writes only. Historical backfill is separately
-- gated by a documented restore snapshot and post-deploy regression checks.

create or replace function public.entry_display_person_name_v1(p_name text)
returns text
language sql
immutable
set search_path = ''
as $fn$
  select case
    when p_name is null then null
    else initcap(lower(regexp_replace(btrim(p_name), '[[:space:]]+', ' ', 'g')))
  end;
$fn$;

revoke all on function public.entry_display_person_name_v1(text) from public, anon, authenticated;
-- Required for invoker-rights triggers on resident-facing writes.
-- This helper is pure text formatting and exposes no stored data.
grant execute on function public.entry_display_person_name_v1(text) to anon, authenticated, service_role;

-- One trigger implementation keeps all person-name fields consistent at write time.
-- No changes to UUIDs, email, username, PIN, roles, membership, or access fields.
create or replace function public.entry_person_name_write_guard_v1()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  if TG_TABLE_NAME = 'profiles' then
    NEW.full_name := public.entry_display_person_name_v1(NEW.full_name);
  elsif TG_TABLE_NAME = 'resident_activation_queue' then
    NEW.resident_name := public.entry_display_person_name_v1(NEW.resident_name);
  elsif TG_TABLE_NAME = 'community_registration_residents' then
    NEW.full_name := public.entry_display_person_name_v1(NEW.full_name);
    -- Keep the deliberately lowercase comparison key, including on imports.
    -- Inline only the canonical lowercase transformation here: the
    -- existing identity-normalization helper is intentionally service-role only.
    NEW.normalized_full_name := nullif(lower(regexp_replace(btrim(coalesce(NEW.full_name, '')), '[[:space:]]+', ' ', 'g')), '');
  elsif TG_TABLE_NAME = 'resident_invites' then
    NEW.full_name := public.entry_display_person_name_v1(NEW.full_name);
  elsif TG_TABLE_NAME = 'resident_favorites' then
    NEW.full_name := public.entry_display_person_name_v1(NEW.full_name);
  elsif TG_TABLE_NAME = 'houses' then
    NEW.owner_name := public.entry_display_person_name_v1(NEW.owner_name);
  else
    raise exception 'Unexpected trigger target: %', TG_TABLE_NAME;
  end if;
  return NEW;
end;
$fn$;

revoke all on function public.entry_person_name_write_guard_v1() from public, anon, authenticated;

create trigger trg_zz_entry_profile_display_name
  before insert or update of full_name on public.profiles
  for each row execute function public.entry_person_name_write_guard_v1();
create trigger trg_zz_entry_activation_display_name
  before insert or update of resident_name on public.resident_activation_queue
  for each row execute function public.entry_person_name_write_guard_v1();
create trigger trg_zz_entry_registration_display_name
  before insert or update of full_name on public.community_registration_residents
  for each row execute function public.entry_person_name_write_guard_v1();
create trigger trg_zz_entry_invite_display_name
  before insert or update of full_name on public.resident_invites
  for each row execute function public.entry_person_name_write_guard_v1();
create trigger trg_zz_entry_favorite_display_name
  before insert or update of full_name on public.resident_favorites
  for each row execute function public.entry_person_name_write_guard_v1();
create trigger trg_zz_entry_owner_display_name
  before insert or update of owner_name on public.houses
  for each row execute function public.entry_person_name_write_guard_v1();
