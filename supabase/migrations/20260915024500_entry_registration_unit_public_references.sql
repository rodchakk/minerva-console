-- ENTRY Resident Registration optional public unit references.
--
-- Adds presentation-only metadata for resident-facing unit identification.
-- The operational identity remains unit_label_snapshot / normalized_unit_label.

alter table public.community_registration_units
  add column if not exists public_reference text;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'cr_units_public_reference_format'
       and conrelid = 'public.community_registration_units'::regclass
  ) then
    alter table public.community_registration_units
      add constraint cr_units_public_reference_format
      check (
        public_reference is null
        or (
          public_reference = btrim(public_reference)
          and public_reference <> ''
          and char_length(public_reference) <= 160
        )
      );
  end if;
end;
$$;

comment on column public.community_registration_units.public_reference is
  'Optional resident-facing location/reference text used only to help identify a campaign unit. Not part of unit identity.';

create or replace function public.set_community_registration_unit_public_references_v1(
  p_campaign_id uuid,
  p_references jsonb,
  p_actor_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_campaign public.community_registration_campaigns%rowtype;
  v_key text;
  v_value jsonb;
  v_normalized_label text;
  v_reference text;
  v_unit_id uuid;
  v_current_reference text;
  v_updated_count integer := 0;
  v_unchanged_count integer := 0;
  v_reference_count integer := 0;
begin
  perform public._cr_service_role_only_v1();
  perform public._cr_validate_actor_v1(p_actor_user_id);

  if p_actor_user_id is null then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_ACTOR', '42501');
  end if;

  if p_campaign_id is null
     or p_references is null
     or jsonb_typeof(p_references) <> 'object' then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_CAMPAIGN');
  end if;

  select count(*)::integer
    into v_reference_count
    from jsonb_object_keys(p_references);

  select * into v_campaign
    from public.community_registration_campaigns
   where id = p_campaign_id
   for update;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_CAMPAIGN_UNAVAILABLE');
  end if;

  if v_campaign.registration_mode <> 'existing_units'
     or v_campaign.status not in ('draft', 'open', 'paused', 'review') then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_STATE', 'P0409');
  end if;

  if exists (
    select 1
      from jsonb_object_keys(p_references) as keys(key_name)
     where public._cr_normalize_unit_label_v1(keys.key_name) is null
  ) then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_UNIT');
  end if;

  if exists (
    select 1
      from jsonb_object_keys(p_references) as keys(key_name)
     group by public._cr_normalize_unit_label_v1(keys.key_name)
    having count(*) > 1
  ) then
    perform public._cr_raise_v1('ENTRY_CR_CONFLICT', 'P0409');
  end if;

  for v_key, v_value in
    select key, value
      from jsonb_each(p_references)
  loop
    v_normalized_label := public._cr_normalize_unit_label_v1(v_key);

    if jsonb_typeof(v_value) = 'null' then
      v_reference := null;
    elsif jsonb_typeof(v_value) = 'string' then
      v_reference := nullif(btrim(v_value #>> '{}'), '');
      if v_reference is not null and char_length(v_reference) > 160 then
        perform public._cr_raise_v1('ENTRY_CR_INVALID_UNIT');
      end if;
    else
      perform public._cr_raise_v1('ENTRY_CR_INVALID_UNIT');
    end if;

    select u.id, u.public_reference
      into v_unit_id, v_current_reference
      from public.community_registration_units u
     where u.campaign_id = p_campaign_id
       and u.normalized_unit_label = v_normalized_label
     for update;

    if not found then
      perform public._cr_raise_v1('ENTRY_CR_UNIT_UNAVAILABLE');
    end if;

    if v_current_reference is distinct from v_reference then
      update public.community_registration_units
         set public_reference = v_reference
       where id = v_unit_id;
      v_updated_count := v_updated_count + 1;
    else
      v_unchanged_count := v_unchanged_count + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'campaign_id', p_campaign_id,
    'updated_count', v_updated_count,
    'unchanged_count', v_unchanged_count,
    'reference_count', v_reference_count
  );
end;
$function$;

revoke all on function public.set_community_registration_unit_public_references_v1(uuid, jsonb, uuid) from public;
revoke all on function public.set_community_registration_unit_public_references_v1(uuid, jsonb, uuid) from anon;
revoke all on function public.set_community_registration_unit_public_references_v1(uuid, jsonb, uuid) from authenticated;
grant execute on function public.set_community_registration_unit_public_references_v1(uuid, jsonb, uuid) to service_role;
