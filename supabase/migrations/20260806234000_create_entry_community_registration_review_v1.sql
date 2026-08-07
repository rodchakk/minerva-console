-- ENTRY-ONB-003: Community Registration review and patronato confirmation backend v1.
--
-- Forward-only local migration. Do not apply to live Supabase without the
-- required disposable PostgreSQL/Supabase gate.
--
-- Canonical lock order for mutating RPCs:
--   campaign row -> campaign unit row -> current submission row -> token row.
-- Token-driven patronato operations receive a server-side token hash, but the
-- token is locked only after campaign, unit and submission scope is fixed.

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
    'campaign_confirmed'
  ));

alter table public.community_registration_events
  drop constraint if exists cr_events_actor_type_check;

alter table public.community_registration_events
  add constraint cr_events_actor_type_check
  check (actor_type in (
    'resident_token',
    'patronato_token',
    'superadmin',
    'service_role',
    'entry_admin',
    'system'
  ));

alter table public.community_registration_events
  drop constraint if exists cr_events_actor_shape_check;

alter table public.community_registration_events
  add constraint cr_events_actor_shape_check
  check (
    (
      actor_type in ('resident_token', 'patronato_token')
      and access_token_id is not null
      and actor_user_id is null
    )
    or (
      actor_type in ('superadmin', 'entry_admin')
      and actor_user_id is not null
    )
    or actor_type in ('service_role', 'system')
  );

create table if not exists public.community_registration_reviews (
  id                  uuid        not null default gen_random_uuid() primary key,
  campaign_id         uuid        not null,
  campaign_unit_id    uuid        not null,
  submission_id       uuid        not null,
  decision            text        not null
                                      constraint cr_reviews_decision_check
                                      check (decision in (
                                        'reviewed',
                                        'correction_requested',
                                        'confirmed'
                                      )),
  actor_type          text        not null
                                      constraint cr_reviews_actor_type_check
                                      check (actor_type in (
                                        'entry_admin',
                                        'patronato',
                                        'system'
                                      )),
  actor_user_id       uuid
                                      references auth.users(id)
                                      on delete set null,
  access_token_id     uuid,
  observation_text    text
                                      constraint cr_reviews_observation_length
                                      check (observation_text is null or length(observation_text) <= 1000),
  is_current          boolean     not null default true,
  resolution_status   text        not null default 'resolved'
                                      constraint cr_reviews_resolution_status_check
                                      check (resolution_status in (
                                        'pending',
                                        'resolved',
                                        'replaced'
                                      )),
  replaced_at         timestamptz,
  resolved_at         timestamptz,
  created_at          timestamptz not null default now(),

  constraint cr_reviews_unit_scope_fk
    foreign key (campaign_unit_id, campaign_id)
    references public.community_registration_units(id, campaign_id)
    on delete restrict,
  constraint cr_reviews_submission_scope_fk
    foreign key (submission_id, campaign_unit_id, campaign_id)
    references public.community_registration_submissions(id, campaign_unit_id, campaign_id)
    on delete restrict,
  constraint cr_reviews_token_scope_fk
    foreign key (access_token_id, campaign_id)
    references public.community_registration_access_tokens(id, campaign_id)
    on delete restrict,
  constraint cr_reviews_actor_shape_check
    check (
      (
        actor_type = 'entry_admin'
        and actor_user_id is not null
        and access_token_id is null
      )
      or (
        actor_type = 'patronato'
        and actor_user_id is null
        and access_token_id is not null
      )
      or (
        actor_type = 'system'
        and actor_user_id is null
        and access_token_id is null
      )
    ),
  constraint cr_reviews_correction_observation_required
    check (
      decision <> 'correction_requested'
      or observation_text is not null
    ),
  constraint cr_reviews_pending_only_for_correction
    check (
      resolution_status <> 'pending'
      or decision = 'correction_requested'
    ),
  constraint cr_reviews_replaced_timestamp_check
    check ((is_current = false) or replaced_at is null),
  constraint cr_reviews_resolved_timestamp_check
    check (
      resolution_status <> 'resolved'
      or resolved_at is not null
      or decision in ('reviewed', 'confirmed')
    )
);

create unique index if not exists idx_cr_reviews_one_current_per_unit
  on public.community_registration_reviews (campaign_unit_id)
  where is_current;

create index if not exists idx_cr_reviews_campaign_pending
  on public.community_registration_reviews (campaign_id, created_at desc)
  where decision = 'correction_requested' and is_current and resolution_status = 'pending';

create index if not exists idx_cr_reviews_submission_created
  on public.community_registration_reviews (submission_id, created_at desc);

create table if not exists public.community_registration_incomplete_confirmation_authorizations (
  id                     uuid        not null default gen_random_uuid() primary key,
  campaign_id            uuid        not null
                                         references public.community_registration_campaigns(id)
                                         on delete restrict,
  actor_user_id          uuid        not null
                                         references auth.users(id)
                                         on delete restrict,
  reason                 text        not null
                                         constraint cr_incomplete_auth_reason_not_blank
                                         check (btrim(reason) <> '' and length(reason) <= 1000),
  unregistered_count     integer     not null
                                         constraint cr_incomplete_auth_count_nonnegative
                                         check (unregistered_count >= 0),
  status                 text        not null default 'active'
                                         constraint cr_incomplete_auth_status_check
                                         check (status in ('active', 'consumed', 'revoked')),
  consumed_at            timestamptz,
  created_at             timestamptz not null default now(),

  constraint cr_incomplete_auth_consumed_timestamp_check
    check ((status = 'consumed') = (consumed_at is not null))
);

create unique index if not exists idx_cr_incomplete_auth_one_active_campaign
  on public.community_registration_incomplete_confirmation_authorizations (campaign_id)
  where status = 'active';

alter table public.community_registration_reviews enable row level security;
alter table public.community_registration_incomplete_confirmation_authorizations enable row level security;

revoke all on table public.community_registration_reviews from public, anon, authenticated;
revoke all on table public.community_registration_incomplete_confirmation_authorizations from public, anon, authenticated;

create or replace function public._cr_validate_observation_v1(p_observation text)
returns text
language plpgsql
set search_path to 'public'
as $function$
declare
  v_observation text := nullif(regexp_replace(btrim(coalesce(p_observation, '')), '\s+', ' ', 'g'), '');
begin
  if v_observation is null or length(v_observation) > 1000 then
    perform public._cr_raise_v1('ENTRY_CR_CORRECTION_REQUIRED', 'P0400');
  end if;

  return v_observation;
end;
$function$;

revoke all on function public._cr_validate_observation_v1(text) from public;
revoke all on function public._cr_validate_observation_v1(text) from anon;
revoke all on function public._cr_validate_observation_v1(text) from authenticated;

create or replace function public._cr_replace_current_review_v1(
  p_campaign_unit_id uuid
)
returns void
language plpgsql
set search_path to 'public'
as $function$
begin
  update public.community_registration_reviews
     set is_current = false,
         resolution_status = case
           when decision = 'correction_requested' and resolution_status = 'pending'
             then 'resolved'
           else 'replaced'
         end,
         replaced_at = now(),
         resolved_at = case
           when decision = 'correction_requested' and resolution_status = 'pending'
             then now()
           else resolved_at
         end
   where campaign_unit_id = p_campaign_unit_id
     and is_current;
end;
$function$;

revoke all on function public._cr_replace_current_review_v1(uuid) from public;
revoke all on function public._cr_replace_current_review_v1(uuid) from anon;
revoke all on function public._cr_replace_current_review_v1(uuid) from authenticated;

create or replace function public._cr_patronato_token_v1(
  p_campaign_id uuid,
  p_patronato_token_hash text
)
returns public.community_registration_access_tokens
language plpgsql
set search_path to 'public'
as $function$
declare
  v_token public.community_registration_access_tokens%rowtype;
  v_campaign public.community_registration_campaigns%rowtype;
begin
  select * into v_token
    from public.community_registration_access_tokens
   where token_hash = btrim(coalesce(p_patronato_token_hash, ''))
     and token_type = 'patronato_review'
     and campaign_id = p_campaign_id
   for update;

  if not found
     or v_token.status <> 'active'
     or v_token.revoked_at is not null
     or v_token.consumed_at is not null then
    perform public._cr_raise_v1('ENTRY_CR_PATRONATO_ACCESS_INVALID', '42501');
  end if;

  if v_token.expires_at is not null and v_token.expires_at <= now() then
    perform public._cr_raise_v1('ENTRY_CR_PATRONATO_ACCESS_EXPIRED', '42501');
  end if;

  select * into v_campaign
    from public.community_registration_campaigns
   where id = p_campaign_id;

  if not found or v_campaign.status not in ('open', 'review') then
    perform public._cr_raise_v1('ENTRY_CR_PATRONATO_ACCESS_INVALID', '42501');
  end if;

  return v_token;
end;
$function$;

revoke all on function public._cr_patronato_token_v1(uuid, text) from public;
revoke all on function public._cr_patronato_token_v1(uuid, text) from anon;
revoke all on function public._cr_patronato_token_v1(uuid, text) from authenticated;

create or replace function public.create_community_registration_patronato_access_v1(
  p_campaign_id uuid,
  p_patronato_token_hash text,
  p_expires_at timestamptz,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_campaign public.community_registration_campaigns%rowtype;
  v_token_id uuid;
  v_revoked_count integer := 0;
begin
  perform public._cr_service_role_only_v1();
  perform public._cr_validate_actor_v1(p_actor_user_id);

  if p_patronato_token_hash is null or length(btrim(p_patronato_token_hash)) < 32 then
    perform public._cr_raise_v1('ENTRY_CR_PATRONATO_ACCESS_INVALID', '42501');
  end if;

  if p_expires_at is null or p_expires_at <= now() then
    perform public._cr_raise_v1('ENTRY_CR_PATRONATO_ACCESS_EXPIRED', '42501');
  end if;

  select * into v_campaign
    from public.community_registration_campaigns
   where id = p_campaign_id
   for update;

  if not found or v_campaign.status in ('confirmed', 'processed', 'closed') then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_REVIEW_STATE', 'P0409');
  end if;

  update public.community_registration_access_tokens
     set status = 'revoked',
         revoked_at = now()
   where campaign_id = v_campaign.id
     and token_type = 'patronato_review'
     and status = 'active';

  get diagnostics v_revoked_count = row_count;

  insert into public.community_registration_access_tokens (
    campaign_id,
    token_type,
    token_hash,
    status,
    expires_at,
    created_by
  )
  values (
    v_campaign.id,
    'patronato_review',
    btrim(p_patronato_token_hash),
    'active',
    p_expires_at,
    p_actor_user_id
  )
  returning id into v_token_id;

  insert into public.community_registration_events (
    campaign_id,
    event_type,
    actor_type,
    actor_user_id,
    access_token_id,
    metadata
  )
  values (
    v_campaign.id,
    'patronato_access_created',
    'entry_admin',
    p_actor_user_id,
    v_token_id,
    jsonb_build_object(
      'campaign_status', v_campaign.status,
      'expires_at', p_expires_at,
      'revoked_previous_count', v_revoked_count
    )
  );

  return jsonb_build_object(
    'patronato_access_id', v_token_id,
    'campaign_status', v_campaign.status,
    'public_slug', v_campaign.public_slug,
    'expires_at', p_expires_at,
    'revoked_previous_count', v_revoked_count
  );
end;
$function$;

create or replace function public.revoke_community_registration_patronato_access_v1(
  p_campaign_id uuid,
  p_actor_user_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_campaign public.community_registration_campaigns%rowtype;
  v_revoked_count integer := 0;
begin
  perform public._cr_service_role_only_v1();
  perform public._cr_validate_actor_v1(p_actor_user_id);

  select * into v_campaign
    from public.community_registration_campaigns
   where id = p_campaign_id
   for update;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_CAMPAIGN');
  end if;

  update public.community_registration_access_tokens
     set status = 'revoked',
         revoked_at = now()
   where campaign_id = v_campaign.id
     and token_type = 'patronato_review'
     and status = 'active';

  get diagnostics v_revoked_count = row_count;

  insert into public.community_registration_events (
    campaign_id,
    event_type,
    actor_type,
    actor_user_id,
    metadata
  )
  values (
    v_campaign.id,
    'patronato_access_revoked',
    'entry_admin',
    p_actor_user_id,
    jsonb_build_object(
      'revoked_count', v_revoked_count,
      'reason_length', length(nullif(btrim(p_reason), ''))
    )
  );

  return jsonb_build_object(
    'revoked_count', v_revoked_count,
    'already_revoked', v_revoked_count = 0
  );
end;
$function$;

create or replace function public.resolve_community_registration_patronato_access_v1(
  p_patronato_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_token public.community_registration_access_tokens%rowtype;
  v_campaign public.community_registration_campaigns%rowtype;
  v_community_name text;
  v_total_units integer := 0;
  v_confirmed_units integer := 0;
  v_pending_observations integer := 0;
begin
  perform public._cr_service_role_only_v1();

  select * into v_token
    from public.community_registration_access_tokens
   where token_hash = btrim(coalesce(p_patronato_token_hash, ''))
     and token_type = 'patronato_review'
   for update;

  if not found
     or v_token.status <> 'active'
     or v_token.revoked_at is not null
     or v_token.consumed_at is not null then
    perform public._cr_raise_v1('ENTRY_CR_PATRONATO_ACCESS_INVALID', '42501');
  end if;

  if v_token.expires_at is not null and v_token.expires_at <= now() then
    perform public._cr_raise_v1('ENTRY_CR_PATRONATO_ACCESS_EXPIRED', '42501');
  end if;

  select * into v_campaign
    from public.community_registration_campaigns
   where id = v_token.campaign_id;

  if not found or v_campaign.status not in ('open', 'review') then
    perform public._cr_raise_v1('ENTRY_CR_PATRONATO_ACCESS_INVALID', '42501');
  end if;

  select name into v_community_name
    from public.communities
   where id = v_campaign.community_id;

  select count(*)::integer,
         count(*) filter (where status = 'confirmed')::integer
    into v_total_units, v_confirmed_units
    from public.community_registration_units
   where campaign_id = v_campaign.id;

  select count(*)::integer into v_pending_observations
    from public.community_registration_reviews
   where campaign_id = v_campaign.id
     and decision = 'correction_requested'
     and is_current
     and resolution_status = 'pending';

  return jsonb_build_object(
    'valid', true,
    'campaign', jsonb_build_object(
      'public_title', v_campaign.public_title,
      'community_name', v_community_name,
      'status', v_campaign.status,
      'closes_at', v_campaign.closes_at
    ),
    'summary', jsonb_build_object(
      'total_units', v_total_units,
      'confirmed_units', v_confirmed_units,
      'pending_observations', v_pending_observations
    ),
    'capabilities', jsonb_build_array(
      'view_progress',
      'view_unit',
      'request_correction',
      'confirm_unit',
      'confirm_campaign'
    ),
    'expires_at', v_token.expires_at
  );
end;
$function$;

create or replace function public.start_community_registration_review_v1(
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
begin
  perform public._cr_service_role_only_v1();
  perform public._cr_validate_actor_v1(p_actor_user_id);

  select * into v_campaign
    from public.community_registration_campaigns
   where id = p_campaign_id
   for update;

  if not found or v_campaign.status <> 'open' then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_REVIEW_STATE', 'P0409');
  end if;

  update public.community_registration_campaigns
     set status = 'review',
         updated_by = p_actor_user_id
   where id = v_campaign.id;

  insert into public.community_registration_events (
    campaign_id,
    event_type,
    actor_type,
    actor_user_id,
    metadata
  )
  values (
    v_campaign.id,
    'campaign_review_started',
    'entry_admin',
    p_actor_user_id,
    jsonb_build_object(
      'previous_campaign_status', v_campaign.status,
      'new_campaign_status', 'review'
    )
  );

  return jsonb_build_object(
    'campaign_status', 'review',
    'previous_campaign_status', v_campaign.status
  );
end;
$function$;

create or replace function public.get_community_registration_review_summary_v1(
  p_campaign_id uuid,
  p_patronato_token_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_campaign public.community_registration_campaigns%rowtype;
  v_token public.community_registration_access_tokens%rowtype;
  v_counts jsonb;
  v_resident_count integer := 0;
  v_pending_observations integer := 0;
begin
  perform public._cr_service_role_only_v1();

  select * into v_campaign
    from public.community_registration_campaigns
   where id = p_campaign_id;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_CAMPAIGN');
  end if;

  if p_patronato_token_hash is not null then
    v_token := public._cr_patronato_token_v1(v_campaign.id, p_patronato_token_hash);
  end if;

  select jsonb_build_object(
    'total_units', count(*)::integer,
    'unregistered', count(*) filter (where status = 'unregistered')::integer,
    'submitted', count(*) filter (where status = 'submitted')::integer,
    'edit_enabled', count(*) filter (where status = 'edit_enabled')::integer,
    'needs_correction', count(*) filter (where status = 'needs_correction')::integer,
    'reviewed', count(*) filter (where status = 'reviewed')::integer,
    'confirmed', count(*) filter (where status = 'confirmed')::integer,
    'processed', count(*) filter (where status = 'processed')::integer
  )
  into v_counts
  from public.community_registration_units
  where campaign_id = v_campaign.id;

  select count(r.id)::integer
    into v_resident_count
    from public.community_registration_submissions s
    join public.community_registration_residents r
      on r.submission_id = s.id
   where s.campaign_id = v_campaign.id
     and s.status in ('submitted', 'edit_enabled', 'reviewed', 'confirmed');

  select count(*)::integer into v_pending_observations
    from public.community_registration_reviews
   where campaign_id = v_campaign.id
     and decision = 'correction_requested'
     and is_current
     and resolution_status = 'pending';

  return v_counts
    || jsonb_build_object(
      'current_resident_count', v_resident_count,
      'pending_observations', v_pending_observations,
      'campaign_status', v_campaign.status
    );
end;
$function$;

create or replace function public.list_community_registration_review_units_v1(
  p_campaign_id uuid,
  p_patronato_token_hash text default null,
  p_status text default null,
  p_unit_label_prefix text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_campaign public.community_registration_campaigns%rowtype;
  v_token public.community_registration_access_tokens%rowtype;
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_label_prefix text := public._cr_normalize_unit_label_v1(p_unit_label_prefix);
  v_units jsonb;
begin
  perform public._cr_service_role_only_v1();

  if p_status is not null
     and p_status not in (
       'unregistered',
       'submitted',
       'edit_enabled',
       'needs_correction',
       'reviewed',
       'confirmed',
       'processed'
     ) then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_REVIEW_STATE', 'P0409');
  end if;

  select * into v_campaign
    from public.community_registration_campaigns
   where id = p_campaign_id;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_CAMPAIGN');
  end if;

  if p_patronato_token_hash is not null then
    v_token := public._cr_patronato_token_v1(v_campaign.id, p_patronato_token_hash);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'unit_id', row_data.id,
    'unit_label', row_data.unit_label_snapshot,
    'status', row_data.status,
    'resident_count', row_data.resident_count,
    'submitted_at', row_data.submitted_at,
    'reviewed_at', row_data.reviewed_at,
    'patronato_confirmed_at', row_data.patronato_confirmed_at,
    'has_pending_observation', row_data.has_pending_observation
  ) order by row_data.unit_label_snapshot, row_data.id), '[]'::jsonb)
  into v_units
  from (
    select u.id,
           u.unit_label_snapshot,
           u.status,
           s.submitted_at,
           u.reviewed_at,
           u.patronato_confirmed_at,
           coalesce(count(r.id), 0)::integer as resident_count,
           exists (
             select 1
               from public.community_registration_reviews cr
              where cr.campaign_unit_id = u.id
                and cr.decision = 'correction_requested'
                and cr.is_current
                and cr.resolution_status = 'pending'
           ) as has_pending_observation
      from public.community_registration_units u
      left join public.community_registration_submissions s
        on s.campaign_unit_id = u.id
       and s.status in ('submitted', 'edit_enabled', 'reviewed', 'confirmed')
      left join public.community_registration_residents r
        on r.submission_id = s.id
     where u.campaign_id = v_campaign.id
       and (p_status is null or u.status = p_status)
       and (v_label_prefix is null or u.normalized_unit_label like v_label_prefix || '%')
     group by u.id, u.unit_label_snapshot, u.status, s.submitted_at, u.reviewed_at, u.patronato_confirmed_at
     order by u.unit_label_snapshot, u.id
     limit v_limit
     offset v_offset
  ) row_data;

  return jsonb_build_object(
    'campaign_status', v_campaign.status,
    'limit', v_limit,
    'offset', v_offset,
    'units', v_units
  );
end;
$function$;

create or replace function public.get_community_registration_review_unit_v1(
  p_campaign_id uuid,
  p_campaign_unit_id uuid,
  p_patronato_token_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_campaign public.community_registration_campaigns%rowtype;
  v_token public.community_registration_access_tokens%rowtype;
  v_unit public.community_registration_units%rowtype;
  v_submission public.community_registration_submissions%rowtype;
  v_residents jsonb;
  v_review public.community_registration_reviews%rowtype;
begin
  perform public._cr_service_role_only_v1();

  select * into v_campaign
    from public.community_registration_campaigns
   where id = p_campaign_id;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_CAMPAIGN');
  end if;

  if p_patronato_token_hash is not null then
    v_token := public._cr_patronato_token_v1(v_campaign.id, p_patronato_token_hash);
  end if;

  select * into v_unit
    from public.community_registration_units
   where id = p_campaign_unit_id
     and campaign_id = v_campaign.id;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_UNIT');
  end if;

  select * into v_submission
    from public.community_registration_submissions
   where campaign_unit_id = v_unit.id
     and campaign_id = v_campaign.id
     and status in ('submitted', 'edit_enabled', 'reviewed', 'confirmed')
   order by version_number desc
   limit 1;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_REVIEW_NOT_READY', 'P0409');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'position', r.position,
    'full_name', r.full_name,
    'phone', r.phone,
    'email', r.email,
    'relationship_to_house', r.relationship_to_house,
    'is_owner_reference', r.is_owner_reference
  ) order by r.position), '[]'::jsonb)
  into v_residents
  from public.community_registration_residents r
  where r.submission_id = v_submission.id;

  select * into v_review
    from public.community_registration_reviews
   where campaign_unit_id = v_unit.id
     and is_current
   order by created_at desc
   limit 1;

  return jsonb_build_object(
    'unit_label', v_unit.unit_label_snapshot,
    'status', v_unit.status,
    'version', v_submission.version_number,
    'effective_resident_limit', coalesce(v_unit.resident_limit_override, v_campaign.default_resident_limit),
    'submitted_at', v_submission.submitted_at,
    'reviewed_at', v_unit.reviewed_at,
    'patronato_confirmed_at', v_unit.patronato_confirmed_at,
    'review', case
      when v_review.id is null then null
      else jsonb_build_object(
        'decision', v_review.decision,
        'observation', v_review.observation_text,
        'resolution_status', v_review.resolution_status,
        'created_at', v_review.created_at
      )
    end,
    'residents', v_residents
  );
end;
$function$;

create or replace function public.mark_community_registration_unit_reviewed_v1(
  p_campaign_unit_id uuid,
  p_actor_user_id uuid
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
begin
  perform public._cr_service_role_only_v1();
  perform public._cr_validate_actor_v1(p_actor_user_id);

  select campaign_id into v_campaign_id
    from public.community_registration_units
   where id = p_campaign_unit_id;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_UNIT');
  end if;

  select * into v_campaign
    from public.community_registration_campaigns
   where id = v_campaign_id
   for update;

  if v_campaign.status <> 'review' then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_REVIEW_STATE', 'P0409');
  end if;

  select * into v_unit
    from public.community_registration_units
   where id = p_campaign_unit_id
     and campaign_id = v_campaign.id
   for update;

  if exists (
    select 1
      from public.community_registration_access_tokens
     where campaign_id = v_campaign.id
       and campaign_unit_id = p_campaign_unit_id
       and token_type = 'resident_edit'
       and status = 'active'
       and (expires_at is null or expires_at > now())
       and revoked_at is null
       and consumed_at is null
  ) then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_REVIEW_STATE', 'P0409');
  end if;

  select * into v_submission
    from public.community_registration_submissions
   where campaign_unit_id = v_unit.id
     and campaign_id = v_campaign.id
     and status = 'submitted'
   order by version_number desc
   limit 1
   for update;

  if not found or v_unit.status <> 'submitted' then
    perform public._cr_raise_v1('ENTRY_CR_REVIEW_NOT_READY', 'P0409');
  end if;

  perform public._cr_replace_current_review_v1(v_unit.id);

  update public.community_registration_submissions
     set status = 'reviewed',
         reviewed_at = now(),
         reviewed_by = p_actor_user_id
   where id = v_submission.id;

  update public.community_registration_units
     set status = 'reviewed',
         reviewed_at = now(),
         reviewed_by = p_actor_user_id,
         patronato_confirmed_at = null,
         patronato_confirmed_by = null
   where id = v_unit.id;

  insert into public.community_registration_reviews (
    campaign_id,
    campaign_unit_id,
    submission_id,
    decision,
    actor_type,
    actor_user_id,
    resolution_status,
    resolved_at
  )
  values (
    v_campaign.id,
    v_unit.id,
    v_submission.id,
    'reviewed',
    'entry_admin',
    p_actor_user_id,
    'resolved',
    now()
  );

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
    'unit_reviewed',
    'entry_admin',
    p_actor_user_id,
    jsonb_build_object(
      'version', v_submission.version_number,
      'previous_unit_status', v_unit.status,
      'new_unit_status', 'reviewed'
    )
  );

  return jsonb_build_object(
    'status', 'reviewed',
    'unit_label', v_unit.unit_label_snapshot,
    'version', v_submission.version_number
  );
end;
$function$;

create or replace function public.request_community_registration_correction_v1(
  p_campaign_id uuid,
  p_campaign_unit_id uuid,
  p_observation text,
  p_actor_user_id uuid default null,
  p_patronato_token_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_campaign public.community_registration_campaigns%rowtype;
  v_unit public.community_registration_units%rowtype;
  v_submission public.community_registration_submissions%rowtype;
  v_token public.community_registration_access_tokens%rowtype;
  v_observation text := public._cr_validate_observation_v1(p_observation);
  v_actor_type text;
begin
  perform public._cr_service_role_only_v1();

  if p_patronato_token_hash is null then
    perform public._cr_validate_actor_v1(p_actor_user_id);
    if p_actor_user_id is null then
      perform public._cr_raise_v1('ENTRY_CR_INVALID_ACTOR', '42501');
    end if;
    v_actor_type := 'entry_admin';
  else
    v_actor_type := 'patronato';
  end if;

  select * into v_campaign
    from public.community_registration_campaigns
   where id = p_campaign_id
   for update;

  if not found or v_campaign.status <> 'review' then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_REVIEW_STATE', 'P0409');
  end if;

  select * into v_unit
    from public.community_registration_units
   where id = p_campaign_unit_id
     and campaign_id = v_campaign.id
   for update;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_UNIT');
  end if;

  if v_unit.status = 'confirmed' then
    perform public._cr_raise_v1('ENTRY_CR_ALREADY_CONFIRMED', 'P0409');
  end if;

  select * into v_submission
    from public.community_registration_submissions
   where campaign_unit_id = v_unit.id
     and campaign_id = v_campaign.id
     and status in ('submitted', 'reviewed')
   order by version_number desc
   limit 1
   for update;

  if not found or v_unit.status not in ('submitted', 'reviewed') then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_REVIEW_STATE', 'P0409');
  end if;

  if p_patronato_token_hash is not null then
    v_token := public._cr_patronato_token_v1(v_campaign.id, p_patronato_token_hash);
  end if;

  perform public._cr_replace_current_review_v1(v_unit.id);

  insert into public.community_registration_reviews (
    campaign_id,
    campaign_unit_id,
    submission_id,
    decision,
    actor_type,
    actor_user_id,
    access_token_id,
    observation_text,
    resolution_status
  )
  values (
    v_campaign.id,
    v_unit.id,
    v_submission.id,
    'correction_requested',
    v_actor_type,
    case when v_actor_type = 'entry_admin' then p_actor_user_id else null end,
    case when v_actor_type = 'patronato' then v_token.id else null end,
    v_observation,
    'pending'
  );

  update public.community_registration_units
     set status = 'needs_correction',
         patronato_confirmed_at = null,
         patronato_confirmed_by = null
   where id = v_unit.id;

  insert into public.community_registration_events (
    campaign_id,
    campaign_unit_id,
    submission_id,
    event_type,
    actor_type,
    actor_user_id,
    access_token_id,
    metadata
  )
  values (
    v_campaign.id,
    v_unit.id,
    v_submission.id,
    'correction_requested',
    case when v_actor_type = 'patronato' then 'patronato_token' else 'entry_admin' end,
    case when v_actor_type = 'entry_admin' then p_actor_user_id else null end,
    case when v_actor_type = 'patronato' then v_token.id else null end,
    jsonb_build_object(
      'version', v_submission.version_number,
      'previous_unit_status', v_unit.status,
      'new_unit_status', 'needs_correction',
      'observation_length', length(v_observation)
    )
  );

  return jsonb_build_object(
    'status', 'needs_correction',
    'unit_label', v_unit.unit_label_snapshot,
    'version', v_submission.version_number
  );
end;
$function$;

create or replace function public.confirm_community_registration_unit_v1(
  p_campaign_id uuid,
  p_campaign_unit_id uuid,
  p_patronato_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_campaign public.community_registration_campaigns%rowtype;
  v_unit public.community_registration_units%rowtype;
  v_submission public.community_registration_submissions%rowtype;
  v_token public.community_registration_access_tokens%rowtype;
begin
  perform public._cr_service_role_only_v1();

  select * into v_campaign
    from public.community_registration_campaigns
   where id = p_campaign_id
   for update;

  if not found or v_campaign.status <> 'review' then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_REVIEW_STATE', 'P0409');
  end if;

  select * into v_unit
    from public.community_registration_units
   where id = p_campaign_unit_id
     and campaign_id = v_campaign.id
   for update;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_UNIT');
  end if;

  if v_unit.status = 'confirmed' then
    perform public._cr_raise_v1('ENTRY_CR_ALREADY_CONFIRMED', 'P0409');
  end if;

  if exists (
    select 1
      from public.community_registration_reviews cr
     where cr.campaign_unit_id = v_unit.id
       and cr.decision = 'correction_requested'
       and cr.is_current
       and cr.resolution_status = 'pending'
  ) then
    perform public._cr_raise_v1('ENTRY_CR_CORRECTION_REQUIRED', 'P0409');
  end if;

  if exists (
    select 1
      from public.community_registration_access_tokens t
     where t.campaign_id = v_unit.campaign_id
       and t.campaign_unit_id = v_unit.id
       and t.token_type = 'resident_edit'
       and t.status = 'active'
       and (t.expires_at is null or t.expires_at > now())
       and t.revoked_at is null
       and t.consumed_at is null
  ) then
    perform public._cr_raise_v1('ENTRY_CR_CONFIRMATION_CONFLICT', 'P0409');
  end if;

  select * into v_submission
    from public.community_registration_submissions
   where campaign_unit_id = v_unit.id
     and campaign_id = v_campaign.id
     and status = 'reviewed'
   order by version_number desc
   limit 1
   for update;

  if not found or v_unit.status <> 'reviewed' then
    perform public._cr_raise_v1('ENTRY_CR_CONFIRMATION_CONFLICT', 'P0409');
  end if;

  if exists (
    select 1
      from public.community_registration_submissions s
     where s.campaign_unit_id = v_unit.id
       and s.version_number > v_submission.version_number
       and s.status in ('submitted', 'edit_enabled', 'reviewed', 'confirmed')
  ) then
    perform public._cr_raise_v1('ENTRY_CR_CONFIRMATION_CONFLICT', 'P0409');
  end if;

  v_token := public._cr_patronato_token_v1(v_campaign.id, p_patronato_token_hash);

  perform public._cr_replace_current_review_v1(v_unit.id);

  update public.community_registration_submissions
     set status = 'confirmed',
         patronato_confirmed_at = now(),
         patronato_confirmed_by = v_token.id::text
   where id = v_submission.id;

  update public.community_registration_units
     set status = 'confirmed',
         patronato_confirmed_at = now(),
         patronato_confirmed_by = v_token.id::text
   where id = v_unit.id;

  insert into public.community_registration_reviews (
    campaign_id,
    campaign_unit_id,
    submission_id,
    decision,
    actor_type,
    access_token_id,
    resolution_status,
    resolved_at
  )
  values (
    v_campaign.id,
    v_unit.id,
    v_submission.id,
    'confirmed',
    'patronato',
    v_token.id,
    'resolved',
    now()
  );

  insert into public.community_registration_events (
    campaign_id,
    campaign_unit_id,
    submission_id,
    event_type,
    actor_type,
    access_token_id,
    metadata
  )
  values (
    v_campaign.id,
    v_unit.id,
    v_submission.id,
    'unit_confirmed',
    'patronato_token',
    v_token.id,
    jsonb_build_object(
      'version', v_submission.version_number,
      'previous_unit_status', v_unit.status,
      'new_unit_status', 'confirmed'
    )
  );

  return jsonb_build_object(
    'status', 'confirmed',
    'unit_label', v_unit.unit_label_snapshot,
    'version', v_submission.version_number
  );
end;
$function$;

create or replace function public.authorize_incomplete_campaign_confirmation_v1(
  p_campaign_id uuid,
  p_actor_user_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_campaign public.community_registration_campaigns%rowtype;
  v_unregistered_count integer := 0;
  v_pending_count integer := 0;
  v_authorization_id uuid;
  v_reason text := public._cr_validate_observation_v1(p_reason);
begin
  perform public._cr_service_role_only_v1();
  perform public._cr_validate_actor_v1(p_actor_user_id);

  select * into v_campaign
    from public.community_registration_campaigns
   where id = p_campaign_id
   for update;

  if not found or v_campaign.status <> 'review' then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_REVIEW_STATE', 'P0409');
  end if;

  perform 1
    from public.community_registration_units
   where campaign_id = v_campaign.id
   order by id
   for update;

  select count(*) filter (where status = 'unregistered')::integer,
         count(*) filter (where status in ('submitted', 'edit_enabled', 'needs_correction', 'reviewed'))::integer
    into v_unregistered_count, v_pending_count
    from public.community_registration_units
   where campaign_id = v_campaign.id;

  if v_pending_count > 0 then
    perform public._cr_raise_v1('ENTRY_CR_CAMPAIGN_INCOMPLETE', 'P0409');
  end if;

  if v_unregistered_count = 0 then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_REVIEW_STATE', 'P0409');
  end if;

  update public.community_registration_incomplete_confirmation_authorizations
     set status = 'revoked'
   where campaign_id = v_campaign.id
     and status = 'active';

  insert into public.community_registration_incomplete_confirmation_authorizations (
    campaign_id,
    actor_user_id,
    reason,
    unregistered_count,
    status
  )
  values (
    v_campaign.id,
    p_actor_user_id,
    v_reason,
    v_unregistered_count,
    'active'
  )
  returning id into v_authorization_id;

  insert into public.community_registration_events (
    campaign_id,
    event_type,
    actor_type,
    actor_user_id,
    metadata
  )
  values (
    v_campaign.id,
    'incomplete_confirmation_authorized',
    'entry_admin',
    p_actor_user_id,
    jsonb_build_object(
      'authorization_id', v_authorization_id,
      'unregistered_count', v_unregistered_count,
      'reason_length', length(v_reason)
    )
  );

  return jsonb_build_object(
    'authorization_id', v_authorization_id,
    'unregistered_count', v_unregistered_count,
    'status', 'active'
  );
end;
$function$;

create or replace function public.confirm_community_registration_campaign_v1(
  p_campaign_id uuid,
  p_patronato_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_campaign public.community_registration_campaigns%rowtype;
  v_token public.community_registration_access_tokens%rowtype;
  v_authorization public.community_registration_incomplete_confirmation_authorizations%rowtype;
  v_total_units integer := 0;
  v_confirmed_units integer := 0;
  v_unregistered_units integer := 0;
  v_pending_units integer := 0;
  v_resident_count integer := 0;
begin
  perform public._cr_service_role_only_v1();

  select * into v_campaign
    from public.community_registration_campaigns
   where id = p_campaign_id
   for update;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_REVIEW_STATE', 'P0409');
  end if;

  if v_campaign.status = 'confirmed' then
    perform public._cr_raise_v1('ENTRY_CR_ALREADY_CONFIRMED', 'P0409');
  end if;

  if v_campaign.status <> 'review' then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_REVIEW_STATE', 'P0409');
  end if;

  perform 1
    from public.community_registration_units
   where campaign_id = v_campaign.id
   order by id
   for update;

  v_token := public._cr_patronato_token_v1(v_campaign.id, p_patronato_token_hash);

  select count(*)::integer,
         count(*) filter (where status = 'confirmed')::integer,
         count(*) filter (where status = 'unregistered')::integer,
         count(*) filter (where status in ('submitted', 'edit_enabled', 'needs_correction', 'reviewed'))::integer
    into v_total_units, v_confirmed_units, v_unregistered_units, v_pending_units
    from public.community_registration_units
   where campaign_id = v_campaign.id;

  if v_pending_units > 0 then
    perform public._cr_raise_v1('ENTRY_CR_CAMPAIGN_INCOMPLETE', 'P0409');
  end if;

  if v_confirmed_units = 0 then
    perform public._cr_raise_v1('ENTRY_CR_REVIEW_NOT_READY', 'P0409');
  end if;

  if exists (
    select 1
      from public.community_registration_units u
      left join lateral (
        select s.id,
               s.status,
               s.patronato_confirmed_at
          from public.community_registration_submissions s
         where s.campaign_unit_id = u.id
           and s.status in ('submitted', 'edit_enabled', 'reviewed', 'confirmed')
         order by s.version_number desc
         limit 1
      ) current_submission on true
     where u.campaign_id = v_campaign.id
       and (
         (
           u.status = 'confirmed'
           and (
             current_submission.id is null
             or current_submission.status <> 'confirmed'
             or current_submission.patronato_confirmed_at is null
           )
         )
         or (
           u.status = 'unregistered'
           and current_submission.id is not null
         )
       )
  ) then
    perform public._cr_raise_v1('ENTRY_CR_CONFIRMATION_CONFLICT', 'P0409');
  end if;

  if v_unregistered_units > 0 then
    select * into v_authorization
      from public.community_registration_incomplete_confirmation_authorizations
     where campaign_id = v_campaign.id
       and status = 'active'
     for update;

    if not found or v_authorization.unregistered_count <> v_unregistered_units then
      perform public._cr_raise_v1('ENTRY_CR_CAMPAIGN_INCOMPLETE', 'P0409');
    end if;

    update public.community_registration_incomplete_confirmation_authorizations
       set status = 'consumed',
           consumed_at = now()
     where id = v_authorization.id;
  end if;

  select count(r.id)::integer
    into v_resident_count
    from public.community_registration_submissions s
    join public.community_registration_residents r
      on r.submission_id = s.id
   where s.campaign_id = v_campaign.id
     and s.status = 'confirmed';

  update public.community_registration_campaigns
     set status = 'confirmed',
         confirmed_at = now()
   where id = v_campaign.id;

  update public.community_registration_access_tokens
     set status = 'consumed',
         consumed_at = now()
   where id = v_token.id;

  insert into public.community_registration_events (
    campaign_id,
    event_type,
    actor_type,
    access_token_id,
    metadata
  )
  values (
    v_campaign.id,
    'campaign_confirmed',
    'patronato_token',
    v_token.id,
    jsonb_build_object(
      'previous_campaign_status', v_campaign.status,
      'new_campaign_status', 'confirmed',
      'total_units', v_total_units,
      'confirmed_units', v_confirmed_units,
      'authorized_unregistered_units', v_unregistered_units,
      'approved_resident_count', v_resident_count,
      'authorization_id', case when v_authorization.id is null then null else v_authorization.id end
    )
  );

  return jsonb_build_object(
    'campaign_status', 'confirmed',
    'total_units', v_total_units,
    'confirmed_units', v_confirmed_units,
    'authorized_unregistered_units', v_unregistered_units,
    'approved_resident_count', v_resident_count
  );
end;
$function$;

-- Forward-only replacements from ENTRY-ONB-002. Corrections authorized during
-- review remain valid, while general public registrations continue to require
-- campaign status open.

create or replace function public.enable_community_registration_edit_v1(
  p_campaign_unit_id uuid,
  p_edit_token_hash text,
  p_expires_at timestamptz,
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
  v_unit public.community_registration_units%rowtype;
  v_campaign public.community_registration_campaigns%rowtype;
  v_submission public.community_registration_submissions%rowtype;
  v_token_id uuid;
  v_revoked_count integer;
begin
  perform public._cr_service_role_only_v1();
  perform public._cr_validate_actor_v1(p_actor_user_id);

  if p_edit_token_hash is null or length(btrim(p_edit_token_hash)) < 32 then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_TOKEN');
  end if;

  if p_expires_at is null or p_expires_at <= now() then
    perform public._cr_raise_v1('ENTRY_CR_TOKEN_EXPIRED');
  end if;

  select campaign_id into v_campaign_id
    from public.community_registration_units
   where id = p_campaign_unit_id;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_UNIT_UNAVAILABLE');
  end if;

  select * into v_campaign
    from public.community_registration_campaigns
   where id = v_campaign_id
   for update;

  if v_campaign.status not in ('open', 'review')
     or (v_campaign.opens_at is not null and v_campaign.opens_at > now())
     or (v_campaign.closes_at is not null and v_campaign.closes_at <= now()) then
    perform public._cr_raise_v1('ENTRY_CR_CAMPAIGN_UNAVAILABLE', 'P0409');
  end if;

  select * into v_unit
    from public.community_registration_units
   where id = p_campaign_unit_id
     and campaign_id = v_campaign.id
   for update;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_UNIT_UNAVAILABLE');
  end if;

  select * into v_submission
    from public.community_registration_submissions
   where campaign_unit_id = v_unit.id
     and status in ('submitted', 'reviewed')
   order by version_number desc
   limit 1
   for update;

  if not found or v_unit.status not in ('submitted', 'needs_correction', 'reviewed') then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_STATE', 'P0409');
  end if;

  update public.community_registration_access_tokens
     set status = 'revoked',
         revoked_at = now()
   where campaign_id = v_unit.campaign_id
     and campaign_unit_id = v_unit.id
     and token_type = 'resident_edit'
     and status = 'active';

  get diagnostics v_revoked_count = row_count;

  if v_revoked_count > 0 then
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
      v_unit.campaign_id,
      v_unit.id,
      v_submission.id,
      'resident_edit_token_revoked',
      'entry_admin',
      p_actor_user_id,
      jsonb_build_object('revoked_count', v_revoked_count)
    );
  end if;

  insert into public.community_registration_access_tokens (
    campaign_id,
    campaign_unit_id,
    submission_id,
    token_type,
    token_hash,
    status,
    expires_at,
    created_by
  )
  values (
    v_unit.campaign_id,
    v_unit.id,
    v_submission.id,
    'resident_edit',
    btrim(p_edit_token_hash),
    'active',
    p_expires_at,
    p_actor_user_id
  )
  returning id into v_token_id;

  update public.community_registration_submissions
     set status = 'edit_enabled'
   where id = v_submission.id;

  update public.community_registration_units
     set status = 'edit_enabled'
   where id = v_unit.id;

  insert into public.community_registration_events (
    campaign_id,
    campaign_unit_id,
    submission_id,
    event_type,
    actor_type,
    actor_user_id,
    access_token_id,
    metadata
  )
  values (
    v_unit.campaign_id,
    v_unit.id,
    v_submission.id,
    'resident_edit_enabled',
    'entry_admin',
    p_actor_user_id,
    v_token_id,
    jsonb_build_object(
      'previous_unit_status', v_unit.status,
      'new_unit_status', 'edit_enabled',
      'version', v_submission.version_number,
      'reason_length', length(nullif(btrim(p_reason), ''))
    )
  );

  return jsonb_build_object(
    'campaign_id', v_unit.campaign_id,
    'campaign_unit_id', v_unit.id,
    'submission_id', v_submission.id,
    'edit_token_id', v_token_id,
    'public_slug', v_campaign.public_slug,
    'expires_at', p_expires_at
  );
end;
$function$;

create or replace function public.resolve_community_registration_edit_v1(
  p_edit_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_token public.community_registration_access_tokens%rowtype;
  v_unit public.community_registration_units%rowtype;
  v_submission public.community_registration_submissions%rowtype;
  v_campaign public.community_registration_campaigns%rowtype;
  v_residents jsonb;
begin
  perform public._cr_service_role_only_v1();

  select * into v_token
    from public.community_registration_access_tokens
   where token_hash = btrim(coalesce(p_edit_token_hash, ''))
     and token_type = 'resident_edit'
   for update;

  if not found
     or v_token.status <> 'active'
     or v_token.expires_at is null
     or v_token.expires_at <= now()
     or v_token.revoked_at is not null
     or v_token.consumed_at is not null
     or v_token.campaign_unit_id is null
     or v_token.submission_id is null then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_TOKEN', '42501');
  end if;

  select * into v_unit
    from public.community_registration_units
   where id = v_token.campaign_unit_id
     and campaign_id = v_token.campaign_id;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_STATE', 'P0409');
  end if;

  select * into v_submission
    from public.community_registration_submissions
   where id = v_token.submission_id
     and campaign_unit_id = v_token.campaign_unit_id
     and campaign_id = v_token.campaign_id;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_STATE', 'P0409');
  end if;

  select * into v_campaign
    from public.community_registration_campaigns
   where id = v_token.campaign_id;

  if not found
     or v_unit.status <> 'edit_enabled'
     or v_submission.status <> 'edit_enabled'
     or v_campaign.status not in ('open', 'review')
     or (v_campaign.opens_at is not null and v_campaign.opens_at > now())
     or (v_campaign.closes_at is not null and v_campaign.closes_at <= now()) then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_STATE', 'P0409');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'position', r.position,
    'full_name', r.full_name,
    'email', r.email,
    'phone', r.phone,
    'relationship_to_house', r.relationship_to_house,
    'is_owner_reference', r.is_owner_reference
  ) order by r.position), '[]'::jsonb)
  into v_residents
  from public.community_registration_residents r
  where r.submission_id = v_submission.id;

  return jsonb_build_object(
    'campaign', jsonb_build_object(
      'public_title', v_campaign.public_title,
      'public_instructions', v_campaign.public_instructions,
      'public_slug', v_campaign.public_slug
    ),
    'unit_label', v_unit.unit_label_snapshot,
    'effective_resident_limit', coalesce(v_unit.resident_limit_override, v_campaign.default_resident_limit),
    'expires_at', v_token.expires_at,
    'residents', v_residents
  );
end;
$function$;

create or replace function public.resubmit_community_registration_household_v1(
  p_edit_token_hash text,
  p_residents jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_token_hint record;
  v_campaign public.community_registration_campaigns%rowtype;
  v_unit public.community_registration_units%rowtype;
  v_old_submission public.community_registration_submissions%rowtype;
  v_token public.community_registration_access_tokens%rowtype;
  v_effective_limit integer;
  v_validated jsonb;
  v_resident jsonb;
  v_new_submission_id uuid;
  v_new_version integer;
begin
  perform public._cr_service_role_only_v1();

  select id, campaign_id, campaign_unit_id, submission_id
    into v_token_hint
    from public.community_registration_access_tokens
   where token_hash = btrim(coalesce(p_edit_token_hash, ''))
     and token_type = 'resident_edit';

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_TOKEN', '42501');
  end if;

  select * into v_campaign
    from public.community_registration_campaigns
   where id = v_token_hint.campaign_id
   for update;

  select * into v_unit
    from public.community_registration_units
   where id = v_token_hint.campaign_unit_id
     and campaign_id = v_token_hint.campaign_id
   for update;

  select * into v_old_submission
    from public.community_registration_submissions
   where id = v_token_hint.submission_id
     and campaign_unit_id = v_token_hint.campaign_unit_id
     and campaign_id = v_token_hint.campaign_id
   for update;

  select * into v_token
    from public.community_registration_access_tokens
   where id = v_token_hint.id
   for update;

  if not found
     or v_token.status <> 'active'
     or v_token.expires_at is null
     or v_token.expires_at <= now()
     or v_token.revoked_at is not null
     or v_token.consumed_at is not null then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_TOKEN', '42501');
  end if;

  if v_campaign.status not in ('open', 'review')
     or (v_campaign.opens_at is not null and v_campaign.opens_at > now())
     or (v_campaign.closes_at is not null and v_campaign.closes_at <= now())
     or v_unit.status <> 'edit_enabled'
     or v_old_submission.status <> 'edit_enabled' then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_STATE', 'P0409');
  end if;

  v_effective_limit := coalesce(v_unit.resident_limit_override, v_campaign.default_resident_limit);
  v_validated := public._cr_validate_residents_v1(p_residents, v_effective_limit);

  select coalesce(max(version_number), 0) + 1
    into v_new_version
    from public.community_registration_submissions
   where campaign_unit_id = v_unit.id;

  update public.community_registration_submissions
     set status = 'superseded'
   where id = v_old_submission.id;

  insert into public.community_registration_submissions (
    campaign_unit_id,
    campaign_id,
    community_id,
    house_id,
    version_number,
    status,
    submitted_at,
    locked_at,
    previous_submission_id
  )
  values (
    v_unit.id,
    v_campaign.id,
    v_campaign.community_id,
    v_unit.house_id,
    v_new_version,
    'submitted',
    now(),
    now(),
    v_old_submission.id
  )
  returning id into v_new_submission_id;

  for v_resident in
    select value from jsonb_array_elements(v_validated->'residents')
  loop
    insert into public.community_registration_residents (
      submission_id,
      campaign_id,
      community_id,
      campaign_unit_id,
      house_id,
      position,
      full_name,
      email,
      phone,
      normalized_full_name,
      normalized_email,
      normalized_phone,
      relationship_to_house,
      is_owner_reference,
      validation_status
    )
    values (
      v_new_submission_id,
      v_campaign.id,
      v_campaign.community_id,
      v_unit.id,
      v_unit.house_id,
      (v_resident->>'position')::integer,
      v_resident->>'full_name',
      v_resident->>'email',
      v_resident->>'phone',
      v_resident->>'normalized_full_name',
      v_resident->>'normalized_email',
      v_resident->>'normalized_phone',
      v_resident->>'relationship_to_house',
      (v_resident->>'is_owner_reference')::boolean,
      'valid'
    );
  end loop;

  update public.community_registration_access_tokens
     set status = 'consumed',
         consumed_at = now()
   where id = v_token.id;

  update public.community_registration_units
     set status = 'submitted',
         last_submitted_at = now(),
         reviewed_at = null,
         reviewed_by = null,
         patronato_confirmed_at = null,
         patronato_confirmed_by = null
   where id = v_unit.id;

  insert into public.community_registration_events (
    campaign_id,
    campaign_unit_id,
    submission_id,
    event_type,
    actor_type,
    access_token_id,
    metadata
  )
  values (
    v_campaign.id,
    v_unit.id,
    v_new_submission_id,
    'household_resubmitted',
    'resident_token',
    v_token.id,
    jsonb_build_object(
      'resident_count', (v_validated->>'resident_count')::integer,
      'previous_submission_id', v_old_submission.id,
      'previous_version', v_old_submission.version_number,
      'version', v_new_version,
      'previous_unit_status', v_unit.status,
      'new_unit_status', 'submitted'
    )
  );

  return jsonb_build_object(
    'accepted', true,
    'receipt', jsonb_build_object(
      'version', v_new_version,
      'unit_label', v_unit.unit_label_snapshot,
      'resident_count', (v_validated->>'resident_count')::integer,
      'submitted_at', now()
    )
  );
end;
$function$;

create or replace function public.reset_community_registration_unit_v1(
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
  v_unit public.community_registration_units%rowtype;
  v_campaign public.community_registration_campaigns%rowtype;
  v_submission public.community_registration_submissions%rowtype;
  v_revoked_count integer := 0;
  v_reason text := coalesce(nullif(btrim(p_reason), ''), 'registration_reset');
begin
  perform public._cr_service_role_only_v1();
  perform public._cr_validate_actor_v1(p_actor_user_id);

  select campaign_id into v_campaign_id
    from public.community_registration_units
   where id = p_campaign_unit_id;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_UNIT_UNAVAILABLE');
  end if;

  select * into v_campaign
    from public.community_registration_campaigns
   where id = v_campaign_id
   for update;

  if v_campaign.status in ('confirmed', 'processed', 'closed') then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_REVIEW_STATE', 'P0409');
  end if;

  select * into v_unit
    from public.community_registration_units
   where id = p_campaign_unit_id
     and campaign_id = v_campaign.id
   for update;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_UNIT_UNAVAILABLE');
  end if;

  if v_unit.status = 'unregistered' then
    return jsonb_build_object(
      'campaign_unit_id', v_unit.id,
      'status', 'unregistered',
      'already_unregistered', true,
      'invalidated_submission_id', null,
      'revoked_token_count', 0
    );
  end if;

  if v_unit.status not in ('submitted', 'edit_enabled', 'needs_correction') then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_STATE', 'P0409');
  end if;

  select * into v_submission
    from public.community_registration_submissions
   where campaign_unit_id = v_unit.id
     and status in ('submitted', 'edit_enabled', 'reviewed')
   order by version_number desc
   limit 1
   for update;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_STATE', 'P0409');
  end if;

  update public.community_registration_submissions
     set status = 'invalidated',
         invalidated_at = now(),
         invalidated_reason = v_reason
   where id = v_submission.id;

  update public.community_registration_access_tokens
     set status = 'revoked',
         revoked_at = now()
   where campaign_id = v_unit.campaign_id
     and campaign_unit_id = v_unit.id
     and status = 'active';

  get diagnostics v_revoked_count = row_count;

  perform public._cr_replace_current_review_v1(v_unit.id);

  update public.community_registration_units
     set status = 'unregistered',
         last_submitted_at = null,
         reviewed_at = null,
         reviewed_by = null,
         patronato_confirmed_at = null,
         patronato_confirmed_by = null,
         processed_at = null
   where id = v_unit.id;

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
    v_unit.campaign_id,
    v_unit.id,
    v_submission.id,
    'registration_reset',
    'entry_admin',
    p_actor_user_id,
    jsonb_build_object(
      'previous_unit_status', v_unit.status,
      'new_unit_status', 'unregistered',
      'invalidated_submission_id', v_submission.id,
      'revoked_token_count', v_revoked_count,
      'reason_length', length(v_reason),
      'community_id', v_campaign.community_id
    )
  );

  return jsonb_build_object(
    'campaign_unit_id', v_unit.id,
    'status', 'unregistered',
    'invalidated_submission_id', v_submission.id,
    'revoked_token_count', v_revoked_count
  );
end;
$function$;

comment on table public.community_registration_reviews is
  'Current and historical review decisions and observations for one campaign unit submission. No resident payloads or token hashes are stored.';
comment on table public.community_registration_incomplete_confirmation_authorizations is
  'ENTRY-only authorization for patronato campaign confirmation when remaining units are unregistered.';

comment on function public.create_community_registration_patronato_access_v1(uuid, text, timestamptz, uuid) is
  'ENTRY internal RPC. Creates one active hash-only patronato_review access token scoped to a campaign. service_role only.';
comment on function public.revoke_community_registration_patronato_access_v1(uuid, uuid, text) is
  'ENTRY internal RPC. Revokes active patronato_review tokens for a campaign idempotently. service_role only.';
comment on function public.resolve_community_registration_patronato_access_v1(text) is
  'Backend RPC for future patronato page. Resolves a patronato_review token without returning hashes or resident PII. service_role only.';
comment on function public.start_community_registration_review_v1(uuid, uuid) is
  'ENTRY internal RPC. Moves an open campaign to review so general registration stops while edit corrections remain valid. service_role only.';
comment on function public.get_community_registration_review_summary_v1(uuid, text) is
  'Backend RPC. Returns non-PII review progress for ENTRY or token-scoped patronato access. service_role only.';
comment on function public.list_community_registration_review_units_v1(uuid, text, text, text, integer, integer) is
  'Backend RPC. Lists campaign units for review with no resident PII and token-scoped patronato isolation. service_role only.';
comment on function public.get_community_registration_review_unit_v1(uuid, uuid, text) is
  'Backend RPC. Returns the current submission for one authorized unit; patronato never receives history or token hashes. service_role only.';
comment on function public.mark_community_registration_unit_reviewed_v1(uuid, uuid) is
  'ENTRY internal RPC. Marks one submitted unit as reviewed without confirming it for patronato. service_role only.';
comment on function public.request_community_registration_correction_v1(uuid, uuid, text, uuid, text) is
  'Backend RPC. ENTRY or token-scoped patronato records a bounded observation and moves a submitted/reviewed unit to needs_correction. service_role only.';
comment on function public.confirm_community_registration_unit_v1(uuid, uuid, text) is
  'Patronato backend RPC. Confirms one reviewed unit for the exact current reviewed submission. service_role only.';
comment on function public.authorize_incomplete_campaign_confirmation_v1(uuid, uuid, text) is
  'ENTRY internal RPC. Authorizes final patronato campaign confirmation with only unregistered units remaining. service_role only.';
comment on function public.confirm_community_registration_campaign_v1(uuid, text) is
  'Patronato backend RPC. Confirms the campaign after all submitted/reviewed/correction work is closed and consumes the token. service_role only.';

revoke all on function public.create_community_registration_patronato_access_v1(uuid, text, timestamptz, uuid) from public;
revoke all on function public.revoke_community_registration_patronato_access_v1(uuid, uuid, text) from public;
revoke all on function public.resolve_community_registration_patronato_access_v1(text) from public;
revoke all on function public.start_community_registration_review_v1(uuid, uuid) from public;
revoke all on function public.get_community_registration_review_summary_v1(uuid, text) from public;
revoke all on function public.list_community_registration_review_units_v1(uuid, text, text, text, integer, integer) from public;
revoke all on function public.get_community_registration_review_unit_v1(uuid, uuid, text) from public;
revoke all on function public.mark_community_registration_unit_reviewed_v1(uuid, uuid) from public;
revoke all on function public.request_community_registration_correction_v1(uuid, uuid, text, uuid, text) from public;
revoke all on function public.confirm_community_registration_unit_v1(uuid, uuid, text) from public;
revoke all on function public.authorize_incomplete_campaign_confirmation_v1(uuid, uuid, text) from public;
revoke all on function public.confirm_community_registration_campaign_v1(uuid, text) from public;
revoke all on function public.enable_community_registration_edit_v1(uuid, text, timestamptz, uuid, text) from public;
revoke all on function public.resolve_community_registration_edit_v1(text) from public;
revoke all on function public.resubmit_community_registration_household_v1(text, jsonb) from public;
revoke all on function public.reset_community_registration_unit_v1(uuid, uuid, text) from public;

revoke all on function public.create_community_registration_patronato_access_v1(uuid, text, timestamptz, uuid) from anon;
revoke all on function public.revoke_community_registration_patronato_access_v1(uuid, uuid, text) from anon;
revoke all on function public.resolve_community_registration_patronato_access_v1(text) from anon;
revoke all on function public.start_community_registration_review_v1(uuid, uuid) from anon;
revoke all on function public.get_community_registration_review_summary_v1(uuid, text) from anon;
revoke all on function public.list_community_registration_review_units_v1(uuid, text, text, text, integer, integer) from anon;
revoke all on function public.get_community_registration_review_unit_v1(uuid, uuid, text) from anon;
revoke all on function public.mark_community_registration_unit_reviewed_v1(uuid, uuid) from anon;
revoke all on function public.request_community_registration_correction_v1(uuid, uuid, text, uuid, text) from anon;
revoke all on function public.confirm_community_registration_unit_v1(uuid, uuid, text) from anon;
revoke all on function public.authorize_incomplete_campaign_confirmation_v1(uuid, uuid, text) from anon;
revoke all on function public.confirm_community_registration_campaign_v1(uuid, text) from anon;
revoke all on function public.enable_community_registration_edit_v1(uuid, text, timestamptz, uuid, text) from anon;
revoke all on function public.resolve_community_registration_edit_v1(text) from anon;
revoke all on function public.resubmit_community_registration_household_v1(text, jsonb) from anon;
revoke all on function public.reset_community_registration_unit_v1(uuid, uuid, text) from anon;

revoke all on function public.create_community_registration_patronato_access_v1(uuid, text, timestamptz, uuid) from authenticated;
revoke all on function public.revoke_community_registration_patronato_access_v1(uuid, uuid, text) from authenticated;
revoke all on function public.resolve_community_registration_patronato_access_v1(text) from authenticated;
revoke all on function public.start_community_registration_review_v1(uuid, uuid) from authenticated;
revoke all on function public.get_community_registration_review_summary_v1(uuid, text) from authenticated;
revoke all on function public.list_community_registration_review_units_v1(uuid, text, text, text, integer, integer) from authenticated;
revoke all on function public.get_community_registration_review_unit_v1(uuid, uuid, text) from authenticated;
revoke all on function public.mark_community_registration_unit_reviewed_v1(uuid, uuid) from authenticated;
revoke all on function public.request_community_registration_correction_v1(uuid, uuid, text, uuid, text) from authenticated;
revoke all on function public.confirm_community_registration_unit_v1(uuid, uuid, text) from authenticated;
revoke all on function public.authorize_incomplete_campaign_confirmation_v1(uuid, uuid, text) from authenticated;
revoke all on function public.confirm_community_registration_campaign_v1(uuid, text) from authenticated;
revoke all on function public.enable_community_registration_edit_v1(uuid, text, timestamptz, uuid, text) from authenticated;
revoke all on function public.resolve_community_registration_edit_v1(text) from authenticated;
revoke all on function public.resubmit_community_registration_household_v1(text, jsonb) from authenticated;
revoke all on function public.reset_community_registration_unit_v1(uuid, uuid, text) from authenticated;

grant execute on function public.create_community_registration_patronato_access_v1(uuid, text, timestamptz, uuid) to service_role;
grant execute on function public.revoke_community_registration_patronato_access_v1(uuid, uuid, text) to service_role;
grant execute on function public.resolve_community_registration_patronato_access_v1(text) to service_role;
grant execute on function public.start_community_registration_review_v1(uuid, uuid) to service_role;
grant execute on function public.get_community_registration_review_summary_v1(uuid, text) to service_role;
grant execute on function public.list_community_registration_review_units_v1(uuid, text, text, text, integer, integer) to service_role;
grant execute on function public.get_community_registration_review_unit_v1(uuid, uuid, text) to service_role;
grant execute on function public.mark_community_registration_unit_reviewed_v1(uuid, uuid) to service_role;
grant execute on function public.request_community_registration_correction_v1(uuid, uuid, text, uuid, text) to service_role;
grant execute on function public.confirm_community_registration_unit_v1(uuid, uuid, text) to service_role;
grant execute on function public.authorize_incomplete_campaign_confirmation_v1(uuid, uuid, text) to service_role;
grant execute on function public.confirm_community_registration_campaign_v1(uuid, text) to service_role;
grant execute on function public.enable_community_registration_edit_v1(uuid, text, timestamptz, uuid, text) to service_role;
grant execute on function public.resolve_community_registration_edit_v1(text) to service_role;
grant execute on function public.resubmit_community_registration_household_v1(text, jsonb) to service_role;
grant execute on function public.reset_community_registration_unit_v1(uuid, uuid, text) to service_role;
