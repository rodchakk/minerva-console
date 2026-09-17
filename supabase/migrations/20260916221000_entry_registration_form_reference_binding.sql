-- Preserve resident-provided unit references when a reviewed staging unit is
-- bound to its operational ENTRY house. Existing operational references win;
-- the staging reference only fills a blank value.

create or replace function public._cr_bind_operational_house_v1(
  p_campaign_unit_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_unit public.community_registration_units%rowtype;
  v_campaign public.community_registration_campaigns%rowtype;
  v_house_id uuid;
  v_house_active boolean;
  v_match_count integer := 0;
  v_normalized_label text;
  v_action text := 'already_bound';
begin
  select *
    into v_unit
    from public.community_registration_units
   where id = p_campaign_unit_id
   for update;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_UNIT');
  end if;

  select *
    into v_campaign
    from public.community_registration_campaigns
   where id = v_unit.campaign_id
   for update;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_CAMPAIGN_UNAVAILABLE', 'P0409');
  end if;

  if v_unit.house_id is not null then
    if nullif(public._cr_normalize_name_v1(v_unit.unit_reference_snapshot), '') is not null then
      update public.houses
         set unit_reference = v_unit.unit_reference_snapshot
       where id = v_unit.house_id
         and nullif(public._cr_normalize_name_v1(unit_reference), '') is null;
    end if;

    return jsonb_build_object(
      'house_id', v_unit.house_id,
      'action', v_action,
      'unit_label', v_unit.unit_label_snapshot
    );
  end if;

  if v_campaign.registration_mode <> 'resident_provided_units' then
    perform public._cr_raise_v1('ENTRY_CR_OPERATIONAL_HOUSE_REQUIRED', 'P0409');
  end if;

  if v_unit.status not in ('reviewed', 'confirmed', 'processed') then
    perform public._cr_raise_v1('ENTRY_CR_REVIEW_NOT_READY', 'P0409');
  end if;

  v_normalized_label := public.normalize_unit_label(v_unit.unit_label_snapshot);
  if v_normalized_label is null or btrim(v_normalized_label) = '' then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_UNIT', 'P0409');
  end if;

  perform pg_advisory_xact_lock(
    hashtext(v_unit.community_id::text),
    hashtext(v_normalized_label)
  );

  select count(*)::integer
    into v_match_count
    from public.houses h
   where h.community_id = v_unit.community_id
     and public.normalize_unit_label(h.house_label) = v_normalized_label;

  if v_match_count > 1 then
    perform public._cr_raise_v1('ENTRY_CR_OPERATIONAL_HOUSE_AMBIGUOUS', 'P0409');
  end if;

  if v_match_count = 1 then
    select h.id, h.is_active
      into v_house_id, v_house_active
      from public.houses h
     where h.community_id = v_unit.community_id
       and public.normalize_unit_label(h.house_label) = v_normalized_label
     for update;

    if not coalesce(v_house_active, false) then
      perform public._cr_raise_v1('ENTRY_CR_OPERATIONAL_HOUSE_INACTIVE', 'P0409');
    end if;

    if nullif(public._cr_normalize_name_v1(v_unit.unit_reference_snapshot), '') is not null then
      update public.houses
         set unit_reference = v_unit.unit_reference_snapshot
       where id = v_house_id
         and nullif(public._cr_normalize_name_v1(unit_reference), '') is null;
    end if;

    v_action := 'matched_existing';
  else
    begin
      insert into public.houses (
        community_id,
        house_label,
        unit_reference,
        is_active
      )
      values (
        v_unit.community_id,
        v_unit.unit_label_snapshot,
        nullif(public._cr_normalize_name_v1(v_unit.unit_reference_snapshot), ''),
        true
      )
      returning id into v_house_id;
      v_action := 'created';
    exception
      when unique_violation then
        select h.id, h.is_active
          into v_house_id, v_house_active
          from public.houses h
         where h.community_id = v_unit.community_id
           and public.normalize_unit_label(h.house_label) = v_normalized_label
         order by h.created_at, h.id
         limit 1
         for update;

        if v_house_id is null then
          raise;
        end if;

        if not coalesce(v_house_active, false) then
          perform public._cr_raise_v1('ENTRY_CR_OPERATIONAL_HOUSE_INACTIVE', 'P0409');
        end if;

        if nullif(public._cr_normalize_name_v1(v_unit.unit_reference_snapshot), '') is not null then
          update public.houses
             set unit_reference = v_unit.unit_reference_snapshot
           where id = v_house_id
             and nullif(public._cr_normalize_name_v1(unit_reference), '') is null;
        end if;

        v_action := 'matched_existing';
    end;
  end if;

  if exists (
    select 1
      from public.community_registration_units other_unit
     where other_unit.campaign_id = v_unit.campaign_id
       and other_unit.id <> v_unit.id
       and other_unit.house_id = v_house_id
  ) then
    perform public._cr_raise_v1('ENTRY_CR_OPERATIONAL_HOUSE_ALREADY_LINKED', 'P0409');
  end if;

  if exists (
    select 1
      from public.resident_activation_queue q
      join public.community_registration_residents r
        on r.id = q.community_registration_resident_id
     where r.campaign_unit_id = v_unit.id
       and q.house_id is not null
       and q.house_id is distinct from v_house_id
  ) then
    perform public._cr_raise_v1('ENTRY_CR_TRACEABILITY_CONFLICT', 'P0409');
  end if;

  update public.community_registration_units
     set house_id = v_house_id
   where id = v_unit.id;

  update public.community_registration_submissions
     set house_id = v_house_id
   where campaign_unit_id = v_unit.id;

  update public.community_registration_residents
     set house_id = v_house_id
   where campaign_unit_id = v_unit.id;

  update public.resident_activation_queue q
     set house_id = v_house_id,
         last_error = case
           when q.last_error = 'activation_blocked_missing_house' then null
           else q.last_error
         end,
         updated_at = now()
    from public.community_registration_residents r
   where r.id = q.community_registration_resident_id
     and r.campaign_unit_id = v_unit.id
     and q.community_id = v_unit.community_id
     and (q.house_id is null or q.house_id = v_house_id);

  return jsonb_build_object(
    'house_id', v_house_id,
    'action', v_action,
    'unit_label', v_unit.unit_label_snapshot
  );
end;
$function$;

revoke all on function public._cr_bind_operational_house_v1(uuid) from public;
revoke all on function public._cr_bind_operational_house_v1(uuid) from anon;
revoke all on function public._cr_bind_operational_house_v1(uuid) from authenticated;
grant execute on function public._cr_bind_operational_house_v1(uuid) to service_role;
