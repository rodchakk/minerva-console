-- Admin-only quick edit for resident-registration typo/detail fixes.
-- This intentionally preserves the existing review/correction workflow state.

create or replace function public.quick_edit_community_registration_resident_v1(
  p_actor_user_id uuid,
  p_campaign_unit_id uuid,
  p_submission_id uuid,
  p_resident_id uuid,
  p_full_name text,
  p_email text default null,
  p_phone text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_unit public.community_registration_units%rowtype;
  v_submission public.community_registration_submissions%rowtype;
  v_resident public.community_registration_residents%rowtype;
  v_latest_submission_id uuid;
  v_name text;
  v_email text;
  v_phone text;
  v_digits text;
begin
  perform public._cr_service_role_only_v1();
  perform public._cr_validate_actor_v1(p_actor_user_id);

  if p_campaign_unit_id is null
     or p_submission_id is null
     or p_resident_id is null then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_RESIDENT');
  end if;

  v_name := public._cr_normalize_name_v1(p_full_name);
  v_email := public._cr_normalize_email_v1(p_email);
  v_phone := public._cr_normalize_phone_v1(p_phone);

  if v_name is null or length(v_name) > 160 then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_RESIDENT');
  end if;

  if v_email is not null
     and (length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_RESIDENT');
  end if;

  if v_phone is not null then
    v_digits := regexp_replace(v_phone, '[^0-9]', '', 'g');
    if length(v_phone) > 32
       or v_phone !~ '^\+?[0-9]+$'
       or length(v_digits) < 7 then
      perform public._cr_raise_v1('ENTRY_CR_INVALID_RESIDENT');
    end if;
  end if;

  select * into v_unit
    from public.community_registration_units
   where id = p_campaign_unit_id
   for update;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_UNIT');
  end if;

  -- Quick edits are deliberately limited to the pre-review Submitted state.
  -- Reviewed/confirmed/correction-open records continue through their existing flows.
  if v_unit.status <> 'submitted' then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_REVIEW_STATE', 'P0409');
  end if;

  select s.id into v_latest_submission_id
    from public.community_registration_submissions s
   where s.campaign_unit_id = v_unit.id
     and s.status in ('submitted', 'edit_enabled', 'reviewed', 'confirmed', 'converted')
   order by s.version_number desc
   limit 1;

  if v_latest_submission_id is distinct from p_submission_id then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_REVIEW_STATE', 'P0409');
  end if;

  select * into v_submission
    from public.community_registration_submissions
   where id = p_submission_id
     and campaign_unit_id = v_unit.id
   for update;

  if not found or v_submission.status <> 'submitted' then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_REVIEW_STATE', 'P0409');
  end if;

  select * into v_resident
    from public.community_registration_residents
   where id = p_resident_id
     and submission_id = v_submission.id
     and campaign_unit_id = v_unit.id
   for update;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_RESIDENT');
  end if;

  update public.community_registration_residents
     set full_name = v_name,
         email = v_email,
         phone = v_phone,
         normalized_full_name = lower(v_name),
         normalized_email = v_email,
         normalized_phone = v_phone
   where id = v_resident.id;

  return jsonb_build_object(
    'resident_id', v_resident.id,
    'submission_id', v_submission.id,
    'campaign_unit_id', v_unit.id,
    'full_name', v_name,
    'email', v_email,
    'phone', v_phone,
    'unit_status', v_unit.status,
    'submission_status', v_submission.status
  );
end;
$function$;

revoke all on function public.quick_edit_community_registration_resident_v1(uuid, uuid, uuid, uuid, text, text, text) from public;
revoke all on function public.quick_edit_community_registration_resident_v1(uuid, uuid, uuid, uuid, text, text, text) from anon;
revoke all on function public.quick_edit_community_registration_resident_v1(uuid, uuid, uuid, uuid, text, text, text) from authenticated;
grant execute on function public.quick_edit_community_registration_resident_v1(uuid, uuid, uuid, uuid, text, text, text) to service_role;
