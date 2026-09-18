-- Admin-only unit label correction for resident-provided Community Registration.
-- Keeps the household in Submitted and changes only staging unit identity metadata.

create or replace function public.quick_edit_community_registration_unit_label_v1(
  p_actor_user_id uuid,
  p_campaign_unit_id uuid,
  p_unit_label text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_unit public.community_registration_units%rowtype;
  v_campaign public.community_registration_campaigns%rowtype;
  v_latest_submission_status text;
  v_display_label text;
  v_normalized_label text;
begin
  perform public._cr_service_role_only_v1();
  perform public._cr_validate_actor_v1(p_actor_user_id);

  if p_campaign_unit_id is null then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_UNIT');
  end if;

  v_display_label := public._cr_normalize_name_v1(p_unit_label);
  v_normalized_label := public._cr_normalize_unit_label_v1(p_unit_label);

  if v_display_label is null
     or v_normalized_label is null
     or length(v_display_label) > 160 then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_UNIT_LABEL');
  end if;

  select * into v_unit
    from public.community_registration_units
   where id = p_campaign_unit_id
   for update;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_UNIT');
  end if;

  select * into v_campaign
    from public.community_registration_campaigns
   where id = v_unit.campaign_id;

  if not found
     or v_campaign.registration_mode <> 'resident_provided_units'
     or v_unit.house_id is not null then
    perform public._cr_raise_v1('ENTRY_CR_UNIT_IDENTITY_LOCKED', 'P0409');
  end if;

  -- Match the existing resident quick-edit boundary: only the current Submitted
  -- household can receive an internal typo/identity correction.
  if v_unit.status <> 'submitted' then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_REVIEW_STATE', 'P0409');
  end if;

  select s.status into v_latest_submission_status
    from public.community_registration_submissions s
   where s.campaign_unit_id = v_unit.id
     and s.status in ('submitted', 'edit_enabled', 'reviewed', 'confirmed', 'converted')
   order by s.version_number desc
   limit 1;

  if v_latest_submission_status is distinct from 'submitted' then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_REVIEW_STATE', 'P0409');
  end if;

  if exists (
    select 1
      from public.community_registration_units other
     where other.campaign_id = v_unit.campaign_id
       and other.normalized_unit_label = v_normalized_label
       and other.id <> v_unit.id
  ) then
    perform public._cr_raise_v1('ENTRY_CR_UNIT_LABEL_CONFLICT', 'P0409');
  end if;

  begin
    update public.community_registration_units
       set unit_label_snapshot = v_display_label,
           normalized_unit_label = v_normalized_label
     where id = v_unit.id;
  exception
    when unique_violation then
      perform public._cr_raise_v1('ENTRY_CR_UNIT_LABEL_CONFLICT', 'P0409');
  end;

  return jsonb_build_object(
    'campaign_unit_id', v_unit.id,
    'unit_label', v_display_label,
    'normalized_unit_label', v_normalized_label,
    'unit_status', v_unit.status,
    'registration_mode', v_campaign.registration_mode
  );
end;
$function$;

revoke all on function public.quick_edit_community_registration_unit_label_v1(uuid, uuid, text) from public;
revoke all on function public.quick_edit_community_registration_unit_label_v1(uuid, uuid, text) from anon;
revoke all on function public.quick_edit_community_registration_unit_label_v1(uuid, uuid, text) from authenticated;
grant execute on function public.quick_edit_community_registration_unit_label_v1(uuid, uuid, text) to service_role;

comment on function public.quick_edit_community_registration_unit_label_v1(uuid, uuid, text) is
  'ENTRY internal RPC. Corrects a resident-provided staging unit label while the latest household submission remains Submitted. Does not advance review status or modify operational houses. service_role only.';
