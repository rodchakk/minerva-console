-- Superadmin-only registration correction for Submitted and Patronato-approved households.
-- Confirmed households may update contact fields, never their approved name or identity.
-- The review/approval state and traceability must remain unchanged.

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
  v_campaign public.community_registration_campaigns%rowtype;
  v_campaign_id uuid;
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

  -- Keep conversion's canonical lock order: campaign -> unit -> submission -> resident.
  select campaign_id into v_campaign_id
    from public.community_registration_units
   where id = p_campaign_unit_id;

  if v_campaign_id is null then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_UNIT');
  end if;

  select * into v_campaign
    from public.community_registration_campaigns
   where id = v_campaign_id
   for update;

  if not found or v_campaign.status not in ('open', 'review', 'confirmed') then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_REVIEW_STATE', 'P0409');
  end if;

  select * into v_unit
    from public.community_registration_units
   where id = p_campaign_unit_id
     and campaign_id = v_campaign.id
   for update;

  if not found or v_unit.status not in ('submitted', 'confirmed') then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_REVIEW_STATE', 'P0409');
  end if;

  -- Patronato approval must already be recorded before contact-only corrections.
  if v_unit.status = 'confirmed' and v_unit.patronato_confirmed_at is null then
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

  if not found
     or v_submission.status <> v_unit.status
     or (v_unit.status = 'confirmed' and v_submission.patronato_confirmed_at is null) then
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

  -- Never rewrite the contact of someone already linked to Activation Queue.
  if v_resident.activation_queue_id is not null then
    perform public._cr_raise_v1('ENTRY_CR_RESIDENT_ACTIVATION_LINKED', 'P0409');
  end if;

  -- Patronato approved the resident's identity; only contact info is mutable now.
  if v_unit.status = 'confirmed' and v_name is distinct from v_resident.full_name then
    perform public._cr_raise_v1('ENTRY_CR_APPROVED_IDENTITY_LOCKED', 'P0409');
  end if;

  if v_name is distinct from v_resident.full_name
     or v_email is distinct from v_resident.email
     or v_phone is distinct from v_resident.phone then
    -- No raw emails, phone numbers or names in event metadata.
    insert into public.community_registration_events (
      campaign_id,
      campaign_unit_id,
      submission_id,
      event_type,
      actor_type,
      actor_user_id,
      metadata
    )
    values (
      v_campaign.id,
      v_unit.id,
      v_submission.id,
      'internal_correction',
      'superadmin',
      p_actor_user_id,
      jsonb_build_object(
        'resident_id', v_resident.id,
        'unit_status', v_unit.status,
        'changed_fields', to_jsonb(array_remove(array[
          case when v_name is distinct from v_resident.full_name then 'full_name'::text end,
          case when v_email is distinct from v_resident.email then 'email'::text end,
          case when v_phone is distinct from v_resident.phone then 'phone'::text end
        ], null::text))
      )
    );
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
