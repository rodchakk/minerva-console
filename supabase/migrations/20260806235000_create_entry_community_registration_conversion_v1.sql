-- ENTRY-ONB-004: Community Registration conversion to resident_activation_queue v1.
--
-- Forward-only local migration. Do not apply to live Supabase without the
-- required disposable PostgreSQL/Supabase gate.
--
-- Canonical lock order for mutating RPCs:
--   campaign row -> campaign unit row -> current submission row
--   -> community registration residents -> resident_activation_queue rows.
-- Identity advisory locks are taken after resident locks and before RAQ
-- matching to serialize Community Registration conversions by normalized
-- email or phone. The legacy Excel importer does not participate in those
-- advisory locks, so the conversion revalidates RAQ immediately before writes.

alter table public.resident_activation_queue
  add column if not exists community_registration_resident_id uuid null;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'raq_community_registration_resident_fk'
       and conrelid = 'public.resident_activation_queue'::regclass
  ) then
    alter table public.resident_activation_queue
      add constraint raq_community_registration_resident_fk
      foreign key (community_registration_resident_id)
      references public.community_registration_residents(id)
      on delete restrict;
  end if;
end;
$$;

create unique index if not exists ux_raq_community_registration_resident
  on public.resident_activation_queue (community_registration_resident_id)
  where community_registration_resident_id is not null;

create index if not exists idx_raq_cr_source_pending
  on public.resident_activation_queue (community_id, house_id, status, community_registration_resident_id)
  where status in ('pending', 'invited', 'pin_generated', 'activated');

comment on column public.resident_activation_queue.community_registration_resident_id is
  'Nullable traceability FK to the source Community Registration resident. Used for structural idempotency by community_registration_residents.id; legacy rows remain null.';

alter table public.community_registration_residents
  add column if not exists conversion_last_attempted_at timestamptz,
  add column if not exists conversion_actor_user_id uuid
    references auth.users(id)
    on delete set null;

alter table public.community_registration_residents
  drop constraint if exists cr_residents_conversion_status_check,
  drop constraint if exists cr_residents_queue_requires_prepared,
  drop constraint if exists cr_residents_prepared_requires_queue,
  drop constraint if exists cr_residents_failed_requires_attempt,
  drop constraint if exists cr_residents_last_error_only_on_failure;

alter table public.community_registration_residents
  add constraint cr_residents_conversion_status_check
  check (conversion_status in (
    'not_ready',
    'pending',
    'prepared',
    'converted',
    'already_queued',
    'already_active',
    'skipped_duplicate',
    'blocked_existing_active',
    'invalid',
    'queue_conflict',
    'identity_ambiguous',
    'active_identity_other_context',
    'traceability_conflict',
    'failed'
  )),
  add constraint cr_residents_queue_requires_terminal_link
  check (
    activation_queue_id is null
    or (
      conversion_status in (
        'prepared',
        'converted',
        'already_queued',
        'already_active'
      )
      and converted_at is not null
    )
  ),
  add constraint cr_residents_terminal_link_requires_queue
  check (
    conversion_status not in ('prepared', 'converted', 'already_queued')
    or activation_queue_id is not null
  ),
  add constraint cr_residents_blocking_requires_attempt
  check (
    conversion_status not in (
      'failed',
      'invalid',
      'queue_conflict',
      'identity_ambiguous',
      'active_identity_other_context',
      'traceability_conflict'
    )
    or conversion_attempt_count > 0
  ),
  add constraint cr_residents_last_error_on_non_success
  check (
    conversion_last_error is null
    or conversion_status in (
      'failed',
      'invalid',
      'queue_conflict',
      'identity_ambiguous',
      'active_identity_other_context',
      'traceability_conflict'
    )
  );

create index if not exists idx_cr_residents_conversion_attempts
  on public.community_registration_residents (
    campaign_id,
    campaign_unit_id,
    conversion_status,
    conversion_last_attempted_at desc
  );

comment on column public.community_registration_residents.conversion_last_attempted_at is
  'Timestamp of the last conversion attempt for this source resident. No separate jobs table is used in v1.';
comment on column public.community_registration_residents.conversion_actor_user_id is
  'Internal actor recorded for the last Community Registration conversion attempt.';

alter table public.community_registration_events
  drop constraint if exists cr_events_type_check;

alter table public.community_registration_events
  add constraint cr_events_type_check
  check (event_type in (
    'campaign_created',
    'campaign_opened',
    'campaign_paused',
    'campaign_closed',
    'units_added',
    'household_submitted',
    'resident_edit_enabled',
    'resident_edit_token_revoked',
    'household_resubmitted',
    'registration_reset',
    'unit_submitted',
    'edit_enabled',
    'edit_revoked',
    'submission_resubmitted',
    'unit_reset',
    'internal_correction',
    'marked_for_correction',
    'internal_reviewed',
    'patronato_confirmed',
    'conversion_prepared',
    'conversion_failed',
    'patronato_access_created',
    'patronato_access_revoked',
    'campaign_review_started',
    'unit_reviewed',
    'correction_requested',
    'unit_confirmed',
    'incomplete_confirmation_authorized',
    'campaign_confirmed',
    'resident_conversion_created',
    'resident_conversion_reused_queue',
    'resident_conversion_already_active',
    'resident_conversion_blocked',
    'unit_conversion_attempted',
    'unit_conversion_completed',
    'campaign_processing_completed'
  ));

create or replace function public._cr_conversion_normalize_email_v1(p_email text)
returns text
language sql
immutable
set search_path to 'public'
as $function$
  select nullif(lower(btrim(coalesce(p_email, ''))), '');
$function$;

create or replace function public._cr_conversion_normalize_phone_v1(p_phone text)
returns text
language sql
immutable
set search_path to 'public'
as $function$
  select nullif(regexp_replace(btrim(coalesce(p_phone, '')), '[\s().-]+', '', 'g'), '');
$function$;

create or replace function public._cr_conversion_normalize_name_v1(p_name text)
returns text
language sql
immutable
set search_path to 'public'
as $function$
  select nullif(lower(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g')), '');
$function$;

create or replace function public._cr_conversion_activation_method_v1(
  p_email text,
  p_phone text
)
returns text
language sql
immutable
set search_path to 'public'
as $function$
  select case
    when public._cr_conversion_normalize_email_v1(p_email) is not null
      and public._cr_conversion_normalize_email_v1(p_email) ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
      then 'email'
    when public._cr_conversion_normalize_phone_v1(p_phone) is not null
      then 'phone_pin'
    else 'username_pin'
  end;
$function$;

create or replace function public._cr_conversion_suggest_username_v1(
  p_resident_name text,
  p_community_id uuid,
  p_resident_id uuid
)
returns text
language plpgsql
set search_path to 'public'
as $function$
declare
  v_seed text := substr(md5(coalesce(p_resident_id::text, '')), 1, 12);
  v_base text;
  v_candidate text;
  v_counter integer;
begin
  v_base := public._raq_suggest_username(p_resident_name, p_community_id);
  v_base := nullif(lower(regexp_replace(coalesce(v_base, ''), '[^a-z0-9_]+', '', 'g')), '');

  if v_base is null then
    v_base := 'resident_' || v_seed;
  else
    v_base := left(v_base, 20) || '_' || v_seed;
  end if;

  for v_counter in 0..99 loop
    v_candidate := case
      when v_counter = 0 then v_base
      else left(v_base, 24) || '_' || v_counter::text
    end;

    if not exists (
      select 1
        from public.profiles p
       where p.username is not null
         and lower(p.username) = v_candidate
    )
    and not exists (
      select 1
        from public.resident_activation_queue q
       where q.suggested_username is not null
         and lower(q.suggested_username) = v_candidate
    ) then
      return v_candidate;
    end if;
  end loop;

  v_candidate := left(v_base, 20) || '_' || substr(md5(v_seed || coalesce(p_community_id::text, '')), 1, 12);

  if exists (
    select 1
      from public.profiles p
     where p.username is not null
       and lower(p.username) = v_candidate
  )
  or exists (
    select 1
      from public.resident_activation_queue q
     where q.suggested_username is not null
       and lower(q.suggested_username) = v_candidate
  ) then
    perform public._cr_raise_v1('ENTRY_CR_CONVERSION_RETRYABLE', 'P0409');
  end if;

  return v_candidate;
end;
$function$;

create or replace function public._cr_conversion_lock_identity_v1(
  p_community_id uuid,
  p_house_id uuid,
  p_unit_label text,
  p_name text,
  p_email text,
  p_phone text
)
returns void
language plpgsql
set search_path to 'public'
as $function$
declare
  v_email text := public._cr_conversion_normalize_email_v1(p_email);
  v_phone text := public._cr_conversion_normalize_phone_v1(p_phone);
  v_name text := public._cr_conversion_normalize_name_v1(p_name);
  v_identity text;
begin
  if v_email is not null then
    v_identity := 'email:' || v_email;
  elsif v_phone is not null then
    v_identity := 'phone:' || v_phone;
  elsif v_name is not null then
    v_identity := 'name-only:'
      || coalesce(p_community_id::text, 'no-community')
      || ':'
      || coalesce(p_house_id::text, public.normalize_unit_label(p_unit_label), 'no-unit')
      || ':'
      || v_name;
  else
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('entry-cr-conversion|' || v_identity, 0));
end;
$function$;

create or replace function public._cr_conversion_event_v1(
  p_campaign_id uuid,
  p_campaign_unit_id uuid,
  p_submission_id uuid,
  p_event_type text,
  p_actor_user_id uuid,
  p_metadata jsonb
)
returns void
language plpgsql
set search_path to 'public'
as $function$
begin
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
    p_campaign_id,
    p_campaign_unit_id,
    p_submission_id,
    p_event_type,
    'entry_admin',
    p_actor_user_id,
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$function$;

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

  if v_campaign.status <> 'confirmed'
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
      select count(*)::integer,
             min(q.id),
             min(q.status)
        into v_queue_count, v_related_queue_id, v_related_queue_status
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
         );

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
            and cm.role = 'resident'
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

create or replace function public.preview_community_registration_unit_conversion_v1(
  p_campaign_unit_id uuid,
  p_actor_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  perform public._cr_service_role_only_v1();
  perform public._cr_validate_actor_v1(p_actor_user_id);

  if p_actor_user_id is null then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_ACTOR', '42501');
  end if;

  return public._cr_classify_unit_conversion_v1(p_campaign_unit_id);
end;
$function$;

create or replace function public.convert_community_registration_unit_to_activation_v1(
  p_campaign_unit_id uuid,
  p_actor_user_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_campaign_id uuid;
  v_campaign public.community_registration_campaigns%rowtype;
  v_unit public.community_registration_units%rowtype;
  v_submission public.community_registration_submissions%rowtype;
  v_preview jsonb;
  v_item jsonb;
  v_resident public.community_registration_residents%rowtype;
  v_queue public.resident_activation_queue%rowtype;
  v_queue_id uuid;
  v_method text;
  v_username text;
  v_conversion_status text;
  v_results jsonb := '[]'::jsonb;
  v_converted integer := 0;
  v_already_queued integer := 0;
  v_already_active integer := 0;
  v_blocked integer := 0;
  v_reason text := nullif(btrim(p_reason), '');
begin
  perform public._cr_service_role_only_v1();
  perform public._cr_validate_actor_v1(p_actor_user_id);

  if p_actor_user_id is null then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_ACTOR', '42501');
  end if;

  select campaign_id into v_campaign_id
    from public.community_registration_units
   where id = p_campaign_unit_id;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_CONVERSION_NOT_READY', 'P0409');
  end if;

  select * into v_campaign
    from public.community_registration_campaigns
   where id = v_campaign_id
   for update;

  if not found or v_campaign.status <> 'confirmed' then
    perform public._cr_raise_v1('ENTRY_CR_CONVERSION_NOT_READY', 'P0409');
  end if;

  select * into v_unit
    from public.community_registration_units
   where id = p_campaign_unit_id
     and campaign_id = v_campaign.id
   for update;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_CONVERSION_NOT_READY', 'P0409');
  end if;

  if v_unit.status = 'processed' then
    return public.get_community_registration_conversion_result_v1(p_campaign_unit_id, p_actor_user_id)
      || jsonb_build_object('already_complete', true);
  end if;

  if v_unit.status <> 'confirmed' then
    perform public._cr_raise_v1('ENTRY_CR_CONVERSION_NOT_READY', 'P0409');
  end if;

  select * into v_submission
    from public.community_registration_submissions
   where campaign_unit_id = v_unit.id
     and status = 'confirmed'
   order by version_number desc
   limit 1
   for update;

  if not found
     or v_submission.community_id <> v_campaign.community_id
     or v_submission.house_id <> v_unit.house_id
     or v_submission.patronato_confirmed_at is null then
    perform public._cr_raise_v1('ENTRY_CR_CONFIRMATION_STALE', 'P0409');
  end if;

  perform 1
    from public.community_registration_residents r
   where r.submission_id = v_submission.id
   order by r.position, r.id
   for update;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_RESIDENT_INVALID', 'P0409');
  end if;

  for v_resident in
    select *
      from public.community_registration_residents
     where submission_id = v_submission.id
     order by position, id
  loop
    perform public._cr_conversion_lock_identity_v1(
      v_campaign.community_id,
      v_unit.house_id,
      v_unit.unit_label_snapshot,
      v_resident.full_name,
      v_resident.email,
      v_resident.phone
    );
  end loop;

  perform 1
    from public.resident_activation_queue q
   where q.community_id = v_campaign.community_id
     and (
       q.community_registration_resident_id in (
         select r.id
           from public.community_registration_residents r
          where r.submission_id = v_submission.id
       )
       or (
         q.status in ('pending', 'invited', 'pin_generated', 'activated', 'skipped', 'failed')
         and exists (
           select 1
             from public.community_registration_residents r
            where r.submission_id = v_submission.id
              and public._cr_conversion_normalize_name_v1(q.resident_name)
                  = public._cr_conversion_normalize_name_v1(r.full_name)
              and (
                q.house_id = v_unit.house_id
                or public.normalize_unit_label(q.unit_label) = public.normalize_unit_label(v_unit.unit_label_snapshot)
              )
         )
       )
     )
   order by q.id
   for update;

  v_preview := public._cr_classify_unit_conversion_v1(p_campaign_unit_id);

  perform public._cr_conversion_event_v1(
    v_campaign.id,
    v_unit.id,
    v_submission.id,
    'unit_conversion_attempted',
    p_actor_user_id,
    jsonb_build_object(
      'resident_count', coalesce((v_preview->>'resident_count')::integer, 0),
      'blocking_count', coalesce((v_preview->>'blocking_count')::integer, 0),
      'reason_present', v_reason is not null
    )
  );

  if coalesce((v_preview->>'blocking_count')::integer, 0) > 0
     or coalesce((v_preview->>'eligible')::boolean, false) = false then
    for v_item in
      select value from jsonb_array_elements(coalesce(v_preview->'residents', '[]'::jsonb))
    loop
      if coalesce((v_item->>'blocking')::boolean, false) then
        v_blocked := v_blocked + 1;

        update public.community_registration_residents
           set conversion_status = case v_item->>'category'
                 when 'queue_conflict' then 'queue_conflict'
                 when 'identity_ambiguous' then 'identity_ambiguous'
                 when 'active_identity_other_context' then 'active_identity_other_context'
                 when 'traceability_conflict' then 'traceability_conflict'
                 else 'invalid'
               end,
               conversion_attempt_count = conversion_attempt_count + 1,
               conversion_last_error = coalesce(v_item->>'contract_code', 'ENTRY_CR_CONVERSION_NOT_READY'),
               conversion_last_attempted_at = now(),
               conversion_actor_user_id = p_actor_user_id
         where id = (v_item->>'resident_id')::uuid;

        perform public._cr_conversion_event_v1(
          v_campaign.id,
          v_unit.id,
          v_submission.id,
          'resident_conversion_blocked',
          p_actor_user_id,
          jsonb_build_object(
            'resident_id', (v_item->>'resident_id')::uuid,
            'category', v_item->>'category',
            'contract_code', coalesce(v_item->>'contract_code', 'ENTRY_CR_CONVERSION_NOT_READY'),
            'position', (v_item->>'position')::integer
          )
        );
      end if;
    end loop;

    return jsonb_build_object(
      'campaign_unit_id', v_unit.id,
      'submission_id', v_submission.id,
      'status', 'blocked',
      'blocking_count', v_blocked,
      'results', v_preview->'residents'
    );
  end if;

  for v_item in
    select value from jsonb_array_elements(v_preview->'residents')
  loop
    select * into v_resident
      from public.community_registration_residents
     where id = (v_item->>'resident_id')::uuid
     for update;

    v_queue_id := nullif(v_item->>'related_activation_queue_id', '')::uuid;
    v_method := public._cr_conversion_activation_method_v1(v_resident.email, v_resident.phone);

    if v_item->>'category' = 'ready_new' then
      v_username := null;
      if v_method = 'username_pin' then
        v_username := public._cr_conversion_suggest_username_v1(
          v_resident.full_name,
          v_campaign.community_id,
          v_resident.id
        );
      end if;

      begin
        insert into public.resident_activation_queue (
          community_id,
          house_id,
          unit_label,
          resident_name,
          phone,
          email,
          is_owner_reference,
          suggested_username,
          activation_method,
          status,
          source,
          raw_data,
          created_by,
          community_registration_resident_id
        )
        values (
          v_campaign.community_id,
          v_unit.house_id,
          v_unit.unit_label_snapshot,
          v_resident.full_name,
          v_resident.phone,
          public._cr_conversion_normalize_email_v1(v_resident.email),
          coalesce(v_resident.is_owner_reference, false),
          v_username,
          v_method,
          'pending',
          'community_registration_v1',
          jsonb_build_object(
            'source_version', 'v1',
            'campaign_id', v_campaign.id,
            'campaign_unit_id', v_unit.id,
            'submission_id', v_submission.id,
            'community_registration_resident_id', v_resident.id,
            'resident_position', v_resident.position,
            'relationship_to_house', v_resident.relationship_to_house
          ),
          p_actor_user_id,
          v_resident.id
        )
        returning id into v_queue_id;
      exception
        when unique_violation then
          select *
            into v_queue
            from public.resident_activation_queue
           where community_registration_resident_id = v_resident.id
           for update;

          if not found
             or v_queue.community_id <> v_campaign.community_id
             or (
               v_queue.house_id is not null
               and v_queue.house_id <> v_unit.house_id
             )
             or (
               v_queue.house_id is null
               and public.normalize_unit_label(v_queue.unit_label)
                   <> public.normalize_unit_label(v_unit.unit_label_snapshot)
             ) then
            perform public._cr_raise_v1('ENTRY_CR_TRACEABILITY_CONFLICT', 'P0409');
          end if;

          v_queue_id := v_queue.id;
      end;

      if v_queue_id is null then
        select id
          into v_queue_id
          from public.resident_activation_queue
         where community_registration_resident_id = v_resident.id
         for update;
      end if;

      update public.community_registration_residents
         set activation_queue_id = v_queue_id,
             conversion_status = 'converted',
             conversion_attempt_count = conversion_attempt_count + 1,
             conversion_last_error = null,
             conversion_last_attempted_at = now(),
             conversion_actor_user_id = p_actor_user_id,
             converted_at = now()
       where id = v_resident.id;

      v_converted := v_converted + 1;
      perform public._cr_conversion_event_v1(
        v_campaign.id,
        v_unit.id,
        v_submission.id,
        'resident_conversion_created',
        p_actor_user_id,
        jsonb_build_object(
          'resident_id', v_resident.id,
          'activation_queue_id', v_queue_id,
          'activation_method', v_method,
          'position', v_resident.position
        )
      );
    elsif v_item->>'category' in ('reuse_queue', 'already_linked') then
      select *
        into v_queue
        from public.resident_activation_queue
       where id = v_queue_id
       for update;

      if not found
         or v_queue.community_id <> v_campaign.community_id
         or v_queue.status not in ('pending', 'invited', 'pin_generated', 'activated')
         or (
           v_queue.house_id is not null
           and v_queue.house_id <> v_unit.house_id
         )
         or (
           v_queue.house_id is null
           and public.normalize_unit_label(v_queue.unit_label)
               <> public.normalize_unit_label(v_unit.unit_label_snapshot)
         )
         or (
           v_queue.community_registration_resident_id is not null
           and v_queue.community_registration_resident_id <> v_resident.id
         )
         or (v_queue.status = 'activated' and v_queue.activated_user_id is null) then
        perform public._cr_raise_v1('ENTRY_CR_TRACEABILITY_CONFLICT', 'P0409');
      end if;

      update public.resident_activation_queue
         set community_registration_resident_id = v_resident.id
       where id = v_queue_id
         and community_id = v_campaign.community_id
         and (
           community_registration_resident_id is null
           or community_registration_resident_id = v_resident.id
         );

      if not found then
        perform public._cr_raise_v1('ENTRY_CR_TRACEABILITY_CONFLICT', 'P0409');
      end if;

      v_conversion_status := case
        when v_queue.status = 'activated' then 'already_active'
        else 'already_queued'
      end;

      update public.community_registration_residents
         set activation_queue_id = v_queue_id,
             conversion_status = v_conversion_status,
             conversion_attempt_count = conversion_attempt_count + 1,
             conversion_last_error = null,
             conversion_last_attempted_at = now(),
             conversion_actor_user_id = p_actor_user_id,
             converted_at = now()
       where id = v_resident.id;

      if v_conversion_status = 'already_active' then
        v_already_active := v_already_active + 1;
        perform public._cr_conversion_event_v1(
          v_campaign.id,
          v_unit.id,
          v_submission.id,
          'resident_conversion_already_active',
          p_actor_user_id,
          jsonb_build_object(
            'resident_id', v_resident.id,
            'activation_queue_id', v_queue_id,
            'queue_status', v_queue.status,
            'position', v_resident.position
          )
        );
      else
        v_already_queued := v_already_queued + 1;
        perform public._cr_conversion_event_v1(
          v_campaign.id,
          v_unit.id,
          v_submission.id,
          'resident_conversion_reused_queue',
          p_actor_user_id,
          jsonb_build_object(
            'resident_id', v_resident.id,
            'activation_queue_id', v_queue_id,
            'queue_status', v_queue.status,
            'position', v_resident.position
          )
        );
      end if;
    elsif v_item->>'category' = 'already_active_same_house' then
      update public.community_registration_residents
         set activation_queue_id = null,
             conversion_status = 'already_active',
             conversion_attempt_count = conversion_attempt_count + 1,
             conversion_last_error = null,
             conversion_last_attempted_at = now(),
             conversion_actor_user_id = p_actor_user_id,
             converted_at = now()
       where id = v_resident.id;

      v_already_active := v_already_active + 1;
      perform public._cr_conversion_event_v1(
        v_campaign.id,
        v_unit.id,
        v_submission.id,
        'resident_conversion_already_active',
        p_actor_user_id,
        jsonb_build_object(
          'resident_id', v_resident.id,
          'position', v_resident.position
        )
      );
    else
      perform public._cr_raise_v1('ENTRY_CR_CONVERSION_INCOMPLETE', 'P0409');
    end if;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'resident_id', v_resident.id,
      'position', v_resident.position,
      'category', v_item->>'category',
      'activation_queue_id', v_queue_id,
      'activation_method', v_method
    ));
  end loop;

  if exists (
    select 1
      from public.community_registration_residents r
     where r.submission_id = v_submission.id
       and r.conversion_status not in ('converted', 'already_queued', 'already_active')
  ) then
    perform public._cr_raise_v1('ENTRY_CR_CONVERSION_INCOMPLETE', 'P0409');
  end if;

  update public.community_registration_submissions
     set status = 'converted',
         converted_at = now()
   where id = v_submission.id;

  update public.community_registration_units
     set status = 'processed',
         processed_at = now()
   where id = v_unit.id;

  perform public._cr_conversion_event_v1(
    v_campaign.id,
    v_unit.id,
    v_submission.id,
    'unit_conversion_completed',
    p_actor_user_id,
    jsonb_build_object(
      'converted_count', v_converted,
      'already_queued_count', v_already_queued,
      'already_active_count', v_already_active,
      'previous_unit_status', v_unit.status,
      'new_unit_status', 'processed'
    )
  );

  return jsonb_build_object(
    'campaign_unit_id', v_unit.id,
    'submission_id', v_submission.id,
    'status', 'processed',
    'converted_count', v_converted,
    'already_queued_count', v_already_queued,
    'already_active_count', v_already_active,
    'results', v_results
  );
end;
$function$;

create or replace function public.list_community_registration_units_pending_conversion_v1(
  p_campaign_id uuid,
  p_limit integer default 50,
  p_offset integer default 0,
  p_actor_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_campaign public.community_registration_campaigns%rowtype;
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_units jsonb;
begin
  perform public._cr_service_role_only_v1();
  perform public._cr_validate_actor_v1(p_actor_user_id);

  if p_actor_user_id is null then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_ACTOR', '42501');
  end if;

  select * into v_campaign
    from public.community_registration_campaigns
   where id = p_campaign_id;

  if not found or v_campaign.status <> 'confirmed' then
    perform public._cr_raise_v1('ENTRY_CR_CONVERSION_NOT_READY', 'P0409');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'campaign_unit_id', u.id,
    'unit_label', u.unit_label_snapshot,
    'resident_count', coalesce(rc.resident_count, 0),
    'confirmed_at', u.patronato_confirmed_at,
    'conversion_status', u.status,
    'resident_error_count', coalesce(rc.error_count, 0),
    'last_attempted_at', rc.last_attempted_at
  ) order by u.unit_label_snapshot, u.id), '[]'::jsonb)
  into v_units
  from (
    select *
      from public.community_registration_units
     where campaign_id = p_campaign_id
       and status = 'confirmed'
     order by unit_label_snapshot, id
     limit v_limit
     offset v_offset
  ) u
  left join lateral (
    select count(*)::integer as resident_count,
           count(*) filter (
             where conversion_status in (
               'invalid',
               'queue_conflict',
               'identity_ambiguous',
               'active_identity_other_context',
               'traceability_conflict',
               'failed'
             )
           )::integer as error_count,
           max(conversion_last_attempted_at) as last_attempted_at
      from public.community_registration_residents r
     where r.campaign_unit_id = u.id
  ) rc on true;

  return jsonb_build_object(
    'campaign_id', p_campaign_id,
    'limit', v_limit,
    'offset', v_offset,
    'units', v_units
  );
end;
$function$;

create or replace function public.get_community_registration_conversion_result_v1(
  p_campaign_unit_id uuid,
  p_actor_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_unit public.community_registration_units%rowtype;
  v_submission public.community_registration_submissions%rowtype;
  v_residents jsonb;
begin
  perform public._cr_service_role_only_v1();
  perform public._cr_validate_actor_v1(p_actor_user_id);

  if p_actor_user_id is null then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_ACTOR', '42501');
  end if;

  select * into v_unit
    from public.community_registration_units
   where id = p_campaign_unit_id;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_CONVERSION_NOT_READY', 'P0409');
  end if;

  select * into v_submission
    from public.community_registration_submissions
   where campaign_unit_id = v_unit.id
     and status in ('confirmed', 'converted')
   order by version_number desc
   limit 1;

  select coalesce(jsonb_agg(jsonb_build_object(
    'resident_id', r.id,
    'position', r.position,
    'full_name', r.full_name,
    'email', r.email,
    'phone', r.phone,
    'conversion_status', r.conversion_status,
    'activation_queue_id', r.activation_queue_id,
    'activation_queue_status', q.status,
    'attempt_count', r.conversion_attempt_count,
    'last_error', r.conversion_last_error,
    'last_attempted_at', r.conversion_last_attempted_at,
    'converted_at', r.converted_at,
    'actor_user_id', r.conversion_actor_user_id
  ) order by r.position, r.id), '[]'::jsonb)
  into v_residents
  from public.community_registration_residents r
  left join public.resident_activation_queue q
    on q.id = r.activation_queue_id
   and q.community_id = r.community_id
  where r.campaign_unit_id = v_unit.id
    and (v_submission.id is null or r.submission_id = v_submission.id);

  return jsonb_build_object(
    'campaign_unit_id', v_unit.id,
    'campaign_id', v_unit.campaign_id,
    'community_id', v_unit.community_id,
    'house_id', v_unit.house_id,
    'unit_label', v_unit.unit_label_snapshot,
    'unit_status', v_unit.status,
    'processed_at', v_unit.processed_at,
    'submission', case
      when v_submission.id is null then null
      else jsonb_build_object(
        'submission_id', v_submission.id,
        'version', v_submission.version_number,
        'status', v_submission.status,
        'converted_at', v_submission.converted_at
      )
    end,
    'residents', v_residents
  );
end;
$function$;

create or replace function public.mark_community_registration_campaign_processed_v1(
  p_campaign_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_campaign public.community_registration_campaigns%rowtype;
  v_pending_units integer := 0;
  v_processed_units integer := 0;
  v_blocked_residents integer := 0;
  v_unregistered_units integer := 0;
begin
  perform public._cr_service_role_only_v1();
  perform public._cr_validate_actor_v1(p_actor_user_id);

  if p_actor_user_id is null then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_ACTOR', '42501');
  end if;

  select * into v_campaign
    from public.community_registration_campaigns
   where id = p_campaign_id
   for update;

  if not found or v_campaign.status <> 'confirmed' then
    perform public._cr_raise_v1('ENTRY_CR_CONVERSION_NOT_READY', 'P0409');
  end if;

  perform 1
    from public.community_registration_units
   where campaign_id = v_campaign.id
   order by id
   for update;

  select count(*) filter (
           where status in ('confirmed', 'submitted', 'reviewed', 'needs_correction', 'edit_enabled')
         )::integer,
         count(*) filter (where status = 'processed')::integer,
         count(*) filter (where status = 'unregistered')::integer
    into v_pending_units, v_processed_units, v_unregistered_units
    from public.community_registration_units
   where campaign_id = v_campaign.id;

  if v_pending_units > 0 then
    perform public._cr_raise_v1('ENTRY_CR_CONVERSION_INCOMPLETE', 'P0409');
  end if;

  if v_processed_units = 0 then
    perform public._cr_raise_v1('ENTRY_CR_CONVERSION_INCOMPLETE', 'P0409');
  end if;

  if v_unregistered_units > 0
     and not exists (
       select 1
         from public.community_registration_incomplete_confirmation_authorizations a
        where a.campaign_id = v_campaign.id
          and a.status = 'consumed'
          and a.unregistered_count = v_unregistered_units
     ) then
    perform public._cr_raise_v1('ENTRY_CR_CONVERSION_INCOMPLETE', 'P0409');
  end if;

  select count(*)::integer
    into v_blocked_residents
    from public.community_registration_residents r
   where r.campaign_id = v_campaign.id
     and r.conversion_status in (
       'invalid',
       'queue_conflict',
       'identity_ambiguous',
       'active_identity_other_context',
       'traceability_conflict',
       'failed'
     );

  if v_blocked_residents > 0 then
    perform public._cr_raise_v1('ENTRY_CR_CONVERSION_INCOMPLETE', 'P0409');
  end if;

  update public.community_registration_campaigns
     set status = 'processed',
         processed_at = now(),
         updated_by = p_actor_user_id
   where id = v_campaign.id;

  perform public._cr_conversion_event_v1(
    v_campaign.id,
    null,
    null,
    'campaign_processing_completed',
    p_actor_user_id,
    jsonb_build_object(
      'previous_campaign_status', v_campaign.status,
      'new_campaign_status', 'processed',
      'processed_units', v_processed_units,
      'unregistered_units', v_unregistered_units
    )
  );

  return jsonb_build_object(
    'campaign_id', v_campaign.id,
    'status', 'processed',
    'processed_units', v_processed_units,
    'unregistered_units', v_unregistered_units
  );
end;
$function$;

comment on function public.preview_community_registration_unit_conversion_v1(uuid, uuid) is
  'ENTRY internal read-only preview. Classifies confirmed Community Registration residents before conversion to resident_activation_queue. service_role only.';
comment on function public.convert_community_registration_unit_to_activation_v1(uuid, uuid, text) is
  'ENTRY internal RPC. Atomically converts one confirmed campaign unit into resident_activation_queue rows or terminal active/queued results. Does not create PINs or users. service_role only.';
comment on function public.list_community_registration_units_pending_conversion_v1(uuid, integer, integer, uuid) is
  'ENTRY internal RPC. Lists confirmed campaign units pending conversion without resident PII. service_role only.';
comment on function public.get_community_registration_conversion_result_v1(uuid, uuid) is
  'ENTRY internal RPC. Returns conversion outcome for one campaign unit. Does not expose tokens, PINs, Auth internals, or other units. service_role only.';
comment on function public.mark_community_registration_campaign_processed_v1(uuid, uuid) is
  'ENTRY internal RPC. Marks a confirmed Community Registration campaign processed after all required units are converted. Does not generate PINs. service_role only.';

revoke all on function public._cr_conversion_normalize_email_v1(text) from public, anon, authenticated;
revoke all on function public._cr_conversion_normalize_phone_v1(text) from public, anon, authenticated;
revoke all on function public._cr_conversion_normalize_name_v1(text) from public, anon, authenticated;
revoke all on function public._cr_conversion_activation_method_v1(text, text) from public, anon, authenticated;
revoke all on function public._cr_conversion_suggest_username_v1(text, uuid, uuid) from public, anon, authenticated;
revoke all on function public._cr_conversion_lock_identity_v1(uuid, uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public._cr_conversion_event_v1(uuid, uuid, uuid, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public._cr_classify_unit_conversion_v1(uuid) from public, anon, authenticated;

revoke all on function public.preview_community_registration_unit_conversion_v1(uuid, uuid) from public;
revoke all on function public.convert_community_registration_unit_to_activation_v1(uuid, uuid, text) from public;
revoke all on function public.list_community_registration_units_pending_conversion_v1(uuid, integer, integer, uuid) from public;
revoke all on function public.get_community_registration_conversion_result_v1(uuid, uuid) from public;
revoke all on function public.mark_community_registration_campaign_processed_v1(uuid, uuid) from public;

revoke all on function public.preview_community_registration_unit_conversion_v1(uuid, uuid) from anon;
revoke all on function public.convert_community_registration_unit_to_activation_v1(uuid, uuid, text) from anon;
revoke all on function public.list_community_registration_units_pending_conversion_v1(uuid, integer, integer, uuid) from anon;
revoke all on function public.get_community_registration_conversion_result_v1(uuid, uuid) from anon;
revoke all on function public.mark_community_registration_campaign_processed_v1(uuid, uuid) from anon;

revoke all on function public.preview_community_registration_unit_conversion_v1(uuid, uuid) from authenticated;
revoke all on function public.convert_community_registration_unit_to_activation_v1(uuid, uuid, text) from authenticated;
revoke all on function public.list_community_registration_units_pending_conversion_v1(uuid, integer, integer, uuid) from authenticated;
revoke all on function public.get_community_registration_conversion_result_v1(uuid, uuid) from authenticated;
revoke all on function public.mark_community_registration_campaign_processed_v1(uuid, uuid) from authenticated;

grant execute on function public.preview_community_registration_unit_conversion_v1(uuid, uuid) to service_role;
grant execute on function public.convert_community_registration_unit_to_activation_v1(uuid, uuid, text) to service_role;
grant execute on function public.list_community_registration_units_pending_conversion_v1(uuid, integer, integer, uuid) to service_role;
grant execute on function public.get_community_registration_conversion_result_v1(uuid, uuid) to service_role;
grant execute on function public.mark_community_registration_campaign_processed_v1(uuid, uuid) to service_role;
