-- Permit descriptive unit-label changes when pending activations have a stable
-- house_id. Do not touch queue snapshots, PINs, resident assignments or access.
-- Orphan/name-only activations and open, unregistered campaign units remain blocked.
-- The existing BEFORE/AFTER triggers, uniqueness checks, locking and audit remain.
create or replace function public.enforce_entry_house_label_update_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
set row_security = off
as $$
declare
  v_old_normalized text;
  v_new_normalized text;
  v_new_registration_normalized text;
begin
  if new.house_label is not distinct from old.house_label then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(old.community_id::text, 711309));

  new.house_label := btrim(coalesce(new.house_label, ''));
  if new.house_label = '' or char_length(new.house_label) > 120 then
    raise exception 'invalid_unit_label' using errcode = '22023';
  end if;

  v_old_normalized := public.normalize_unit_label(old.house_label);
  v_new_normalized := public.normalize_unit_label(new.house_label);
  v_new_registration_normalized := public._cr_normalize_unit_label_v1(new.house_label);

  if exists (
    select 1
      from public.houses h
     where h.community_id = old.community_id
       and h.id <> old.id
       and (
         public.normalize_unit_label(h.house_label) = v_new_normalized
         or public._cr_normalize_unit_label_v1(h.house_label) = v_new_registration_normalized
       )
  ) then
    raise exception 'unit_label_conflict' using errcode = '23505';
  end if;

  -- Only name-bound pending rows can lose their identity from a rename.
  -- A queue row already bound by house_id activates using that UUID.
  if exists (
    select 1
      from public.resident_activation_queue q
     where q.community_id = old.community_id
       and q.status in ('pending', 'invited', 'pin_generated')
       and q.house_id is null
       and public.normalize_unit_label(q.unit_label) = v_old_normalized
  ) or exists (
    select 1
      from public.community_registration_units u
      join public.community_registration_campaigns c on c.id = u.campaign_id
     where u.community_id = old.community_id
       and u.house_id = old.id
       and u.status = 'unregistered'
       and c.status in ('open', 'paused')
  ) then
    raise exception 'unit_label_has_pending_registration_or_activation' using errcode = '55000';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_entry_house_label_update_v1()
  from public, anon, authenticated, service_role;
