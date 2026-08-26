-- ENTRY-ONB-012 runtime hotfix 002: preserve user_role enum-safe classifier comparison.
-- Repairs environments where the progressive classifier was applied with cm.role = 'resident'.

create or replace function public._cr_classify_unit_conversion_v1(
  p_campaign_unit_id uuid
)
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
  v_campaign public.community_registration_campaigns%rowtype;
  v_unit public.community_registration_units%rowtype;
  v_submission public.community_registration_submissions%rowtype;
  v_results jsonb := '[]'::jsonb;
  v_blocking_count integer := 0;
  v_resident record;
  v_email text;
  v_phone text;
  v_name text;
  v_method text;
  v_category text;
  v_action text;
  v_code text;
  v_blocking boolean;
  v_related_queue_id uuid;
  v_related_queue_status text;
  v_queue_count integer;
  v_failed_queue_count integer;
  v_partial_queue_count integer;
  v_claimed_queue_ids uuid[] := array[]::uuid[];
  v_active_auth_user_count integer;
  v_active_same_house_count integer;
  v_active_other_context_count integer;
  v_active_other_community_count integer;
  v_active_phone_count integer;
  v_is_valid boolean;
begin
  select * into v_unit
    from public.community_registration_units
   where id = p_campaign_unit_id;

  if not found then
    return jsonb_build_object(
      'eligible', false,
      'blocking_count', 1,
      'code', 'ENTRY_CR_CONVERSION_NOT_READY',
      'residents', '[]'::jsonb
    );
  end if;

  select * into v_campaign
    from public.community_registration_campaigns
   where id = v_unit.campaign_id;

  select * into v_submission
    from public.community_registration_submissions
   where campaign_unit_id = v_unit.id
     and status in ('submitted', 'edit_enabled', 'reviewed', 'confirmed')
   order by version_number desc
   limit 1;

  if v_campaign.status not in ('open', 'review', 'confirmed')
     or v_unit.status not in ('confirmed', 'processed')
     or v_submission.id is null
     or v_submission.status <> 'confirmed'
     or v_submission.patronato_confirmed_at is null
     or v_submission.house_id <> v_unit.house_id
     or v_submission.community_id <> v_campaign.community_id
     or exists (
       select 1
         from public.community_registration_submissions newer
        where newer.campaign_unit_id = v_unit.id
          and newer.status in ('draft', 'submitted', 'edit_enabled', 'reviewed')
          and newer.version_number > v_submission.version_number
     )
     or exists (
       select 1
         from public.community_registration_access_tokens t
        where t.campaign_id = v_campaign.id
          and t.campaign_unit_id = v_unit.id
          and t.token_type = 'resident_edit'
          and t.status = 'active'
     )
     or exists (
       select 1
         from public.community_registration_reviews rv
        where rv.campaign_id = v_campaign.id
          and rv.campaign_unit_id = v_unit.id
          and rv.is_current
          and rv.decision = 'correction_requested'
          and rv.resolution_status = 'pending'
     ) then
    return jsonb_build_object(
      'campaign_id', v_campaign.id,
      'campaign_unit_id', v_unit.id,
      'submission_id', v_submission.id,
      'community_id', v_unit.community_id,
      'house_id', v_unit.house_id,
      'unit_label', v_unit.unit_label_snapshot,
      'eligible', false,
      'blocking_count', 1,
      'code', 'ENTRY_CR_CONVERSION_NOT_READY',
      'residents', '[]'::jsonb
    );
  end if;

  if not exists (
    select 1
      from public.community_registration_residents
     where submission_id = v_submission.id
  ) then
    return jsonb_build_object(
      'campaign_id', v_campaign.id,
      'campaign_unit_id', v_unit.id,
      'submission_id', v_submission.id,
      'community_id', v_unit.community_id,
      'house_id', v_unit.house_id,
      'unit_label', v_unit.unit_label_snapshot,
      'eligible', false,
      'blocking_count', 1,
      'code', 'ENTRY_CR_RESIDENT_INVALID',
      'residents', '[]'::jsonb
    );
  end if;

  for v_resident in
    select r.*
      from public.community_registration_residents r
     where r.submission_id = v_submission.id
     order by r.position, r.id
  loop
    v_email := public._cr_conversion_normalize_email_v1(v_resident.email);
    v_phone := public._cr_conversion_normalize_phone_v1(v_resident.phone);
    v_name := public._cr_conversion_normalize_name_v1(v_resident.full_name);
    v_method := public._cr_conversion_activation_method_v1(v_resident.email, v_resident.phone);
    v_related_queue_id := null;
    v_related_queue_status := null;
    v_category := 'ready_new';
    v_action := 'insert_queue';
    v_code := null;
    v_blocking := false;

    v_is_valid := v_name is not null
      and v_resident.community_id = v_campaign.community_id
      and v_resident.campaign_id = v_campaign.id
      and v_resident.campaign_unit_id = v_unit.id
      and v_resident.house_id = v_unit.house_id
      and (
        v_email is null
        or v_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
      )
      and (
        v_phone is null
        or v_phone ~ '^\+?[0-9]+$'
      );

    if not v_is_valid then
      v_category := 'invalid';
      v_action := 'block';
      v_code := 'ENTRY_CR_RESIDENT_INVALID';
      v_blocking := true;
    end if;

    if not v_blocking then
      select q.id, q.status
        into v_related_queue_id, v_related_queue_status
        from public.resident_activation_queue q
       where q.community_registration_resident_id = v_resident.id
       order by q.id
       limit 1;

      if found then
        if exists (
          select 1
            from public.resident_activation_queue q
           where q.id = v_related_queue_id
             and (
               q.community_id <> v_campaign.community_id
               or (q.house_id is not null and q.house_id <> v_unit.house_id)
               or (
                 q.house_id is null
                 and public.normalize_unit_label(q.unit_label)
                     <> public.normalize_unit_label(v_unit.unit_label_snapshot)
               )
               or (q.status = 'activated' and q.activated_user_id is null)
             )
        ) then
          v_category := 'traceability_conflict';
          v_action := 'block';
          v_code := 'ENTRY_CR_TRACEABILITY_CONFLICT';
          v_blocking := true;
        else
          v_category := 'already_linked';
          v_action := 'reuse_linked_queue';
          v_code := case
            when v_related_queue_status = 'activated' then 'ENTRY_CR_ALREADY_ACTIVE'
            else 'ENTRY_CR_ALREADY_QUEUED'
          end;
        end if;
      end if;
    end if;

    if not v_blocking and v_related_queue_id is null then
      with matching_queue as (
        select q.id, q.status
          from public.resident_activation_queue q
         where q.community_id = v_campaign.community_id
           and q.status in ('pending', 'invited', 'pin_generated', 'activated')
           and (
             q.house_id = v_unit.house_id
             or (
               q.house_id is null
               and public.normalize_unit_label(q.unit_label) = public.normalize_unit_label(v_unit.unit_label_snapshot)
             )
           )
           and public._cr_conversion_normalize_name_v1(q.resident_name) = v_name
           and (
             (v_email is not null and public._cr_conversion_normalize_email_v1(q.email) = v_email)
             or (
               v_email is null
               and v_phone is not null
               and q.email is null
               and public._cr_conversion_normalize_phone_v1(q.phone) = v_phone
             )
             or (
               v_email is null
               and v_phone is null
               and q.email is null
               and q.phone is null
             )
           )
      ),
      queue_count as (
        select count(*)::integer as value
          from matching_queue
      ),
      queue_candidate as (
        select id, status
          from matching_queue
         order by id
         limit 1
      )
      select queue_count.value,
             queue_candidate.id,
             queue_candidate.status
        into v_queue_count, v_related_queue_id, v_related_queue_status
        from queue_count
        left join queue_candidate on true;

      if v_queue_count > 1 then
        v_category := 'queue_conflict';
        v_action := 'block';
        v_code := 'ENTRY_CR_QUEUE_CONFLICT';
        v_blocking := true;
        v_related_queue_id := null;
        v_related_queue_status := null;
      elsif v_queue_count = 1 then
        if v_related_queue_status = 'activated' and exists (
          select 1
            from public.resident_activation_queue q
           where q.id = v_related_queue_id
             and q.activated_user_id is null
        ) then
          v_category := 'queue_conflict';
          v_action := 'block';
          v_code := 'ENTRY_CR_QUEUE_CONFLICT';
          v_blocking := true;
          v_related_queue_id := null;
          v_related_queue_status := null;
        else
          v_category := 'reuse_queue';
          v_action := 'reuse_queue';
          v_code := case
            when v_related_queue_status = 'activated' then 'ENTRY_CR_ALREADY_ACTIVE'
            else 'ENTRY_CR_ALREADY_QUEUED'
          end;
        end if;
      end if;
    end if;

    if not v_blocking and v_category = 'ready_new' then
      select count(*)::integer
        into v_failed_queue_count
        from public.resident_activation_queue q
       where q.community_id = v_campaign.community_id
         and q.status in ('skipped', 'failed')
         and (
           q.house_id = v_unit.house_id
           or public.normalize_unit_label(q.unit_label) = public.normalize_unit_label(v_unit.unit_label_snapshot)
         )
         and public._cr_conversion_normalize_name_v1(q.resident_name) = v_name;

      if v_failed_queue_count > 0 then
        v_category := 'queue_conflict';
        v_action := 'block';
        v_code := 'ENTRY_CR_QUEUE_CONFLICT';
        v_blocking := true;
      end if;
    end if;

    if not v_blocking and v_category = 'ready_new' then
      select count(*)::integer
        into v_partial_queue_count
        from public.resident_activation_queue q
       where q.community_id = v_campaign.community_id
         and q.status in ('pending', 'invited', 'pin_generated', 'activated')
         and (
           q.house_id = v_unit.house_id
           or public.normalize_unit_label(q.unit_label) = public.normalize_unit_label(v_unit.unit_label_snapshot)
         )
         and public._cr_conversion_normalize_name_v1(q.resident_name) = v_name
         and (
           (v_email is not null and q.email is not null and public._cr_conversion_normalize_email_v1(q.email) <> v_email)
           or (v_phone is not null and q.phone is not null and public._cr_conversion_normalize_phone_v1(q.phone) <> v_phone)
         );

      if v_partial_queue_count > 0 then
        v_category := 'identity_ambiguous';
        v_action := 'block';
        v_code := 'ENTRY_CR_IDENTITY_AMBIGUOUS';
        v_blocking := true;
      end if;
    end if;

    if not v_blocking and v_category = 'ready_new' and v_email is not null then
      select
        count(distinct au.id)::integer,
        count(*) filter (
          where coalesce(p.community_id, cm.community_id) = v_campaign.community_id
            and coalesce(p.is_active, true)
            and coalesce(cm.is_active, false)
            and cm.role = 'RESIDENT'::public.user_role
            and coalesce(hr.is_active, false)
            and hr.house_id = v_unit.house_id
        )::integer,
        count(*) filter (
          where coalesce(p.community_id, cm.community_id) = v_campaign.community_id
            and coalesce(p.is_active, true)
            and coalesce(cm.is_active, false)
            and (
              hr.id is null
              or hr.house_id <> v_unit.house_id
            )
        )::integer,
        count(*) filter (
          where coalesce(p.community_id, cm.community_id) <> v_campaign.community_id
        )::integer
        into v_active_auth_user_count,
             v_active_same_house_count,
             v_active_other_context_count,
             v_active_other_community_count
        from auth.users au
        left join public.profiles p
          on p.user_id = au.id
        left join public.community_members cm
          on cm.user_id = au.id
        left join public.house_residents hr
          on hr.user_id = au.id
         and hr.community_id = coalesce(cm.community_id, p.community_id)
         and hr.is_active
       where public._cr_conversion_normalize_email_v1(au.email::text) = v_email;

      if v_active_same_house_count = 1
         and v_active_auth_user_count = 1
         and v_active_other_context_count = 0
         and v_active_other_community_count = 0 then
        v_category := 'already_active_same_house';
        v_action := 'already_active';
        v_code := 'ENTRY_CR_ALREADY_ACTIVE';
      elsif v_active_auth_user_count > 0
         or v_active_same_house_count > 1
         or v_active_other_context_count > 0
         or v_active_other_community_count > 0 then
        v_category := case
          when v_active_other_context_count > 0 or v_active_other_community_count > 0
            then 'active_identity_other_context'
          else 'identity_ambiguous'
        end;
        v_action := 'block';
        v_code := case
          when v_category = 'active_identity_other_context'
            then 'ENTRY_CR_RESIDENT_CONFLICT'
          else 'ENTRY_CR_IDENTITY_AMBIGUOUS'
        end;
        v_blocking := true;
      end if;
    end if;

    if not v_blocking
       and v_related_queue_id is not null
       and v_category in ('reuse_queue', 'already_linked') then
      if v_related_queue_id = any(v_claimed_queue_ids) then
        v_category := 'queue_conflict';
        v_action := 'block';
        v_code := 'ENTRY_CR_QUEUE_CONFLICT';
        v_blocking := true;
        v_related_queue_id := null;
        v_related_queue_status := null;
      else
        v_claimed_queue_ids := array_append(v_claimed_queue_ids, v_related_queue_id);
      end if;
    end if;

    if not v_blocking
       and v_category = 'ready_new'
       and v_email is null
       and v_phone is not null then
      select count(*)::integer
        into v_active_phone_count
        from auth.users au
        left join public.profiles p
          on p.user_id = au.id
        left join public.community_members cm
          on cm.user_id = au.id
        left join public.house_residents hr
          on hr.user_id = au.id
        where v_phone in (
          public._cr_conversion_normalize_phone_v1(au.phone),
          public._cr_conversion_normalize_phone_v1(p.phone)
        )
          and (
            p.user_id is not null
            or cm.user_id is not null
            or hr.user_id is not null
            or au.phone is not null
          );

      if v_active_phone_count > 1 then
        v_category := 'identity_ambiguous';
        v_action := 'block';
        v_code := 'ENTRY_CR_IDENTITY_AMBIGUOUS';
        v_blocking := true;
      elsif v_active_phone_count = 1 then
        v_category := 'identity_ambiguous';
        v_action := 'block';
        v_code := 'ENTRY_CR_IDENTITY_AMBIGUOUS';
        v_blocking := true;
      end if;
    end if;

    if v_blocking then
      v_blocking_count := v_blocking_count + 1;
    end if;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'resident_id', v_resident.id,
      'position', v_resident.position,
      'full_name', v_resident.full_name,
      'email', v_resident.email,
      'phone', v_resident.phone,
      'activation_method', v_method,
      'planned_action', v_action,
      'category', v_category,
      'contract_code', v_code,
      'related_activation_queue_id', v_related_queue_id,
      'related_activation_queue_status', v_related_queue_status,
      'blocking', v_blocking
    ));
  end loop;

  return jsonb_build_object(
    'campaign_id', v_campaign.id,
    'campaign_unit_id', v_unit.id,
    'submission_id', v_submission.id,
    'community_id', v_unit.community_id,
    'house_id', v_unit.house_id,
    'unit_label', v_unit.unit_label_snapshot,
    'eligible', v_blocking_count = 0,
    'blocking_count', v_blocking_count,
    'resident_count', jsonb_array_length(v_results),
    'residents', v_results
  );
end;
$function$;
