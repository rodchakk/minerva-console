-- Normalize ENTRY onboarding/readiness to a fixed seven-step model.
-- Conditional steps remain present and auto-complete when they are not applicable,
-- so Operations and Community Detail show directly comparable percentages.

create or replace function public.get_community_onboarding_progress_v1(p_community_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_community record;
  v_settings record;
  v_review record;
  v_units_count integer := 0;
  v_active_units_count integer := 0;
  v_admin_count integer := 0;
  v_members_count integer := 0;
  v_facilities_count integer := 0;
  v_active_facilities_count integer := 0;
  v_queue_total integer := 0;
  v_queue_pending integer := 0;
  v_queue_failed integer := 0;
  v_queue_pin_generated integer := 0;
  v_queue_activated integer := 0;
  v_details_done boolean := false;
  v_features_done boolean := false;
  v_units_done boolean := false;
  v_admin_done boolean := false;
  v_facilities_done boolean := true;
  v_activation_done boolean := true;
  v_final_done boolean := false;
  v_allow_reservations boolean := false;
  v_allow_messages boolean := false;
  v_allow_frequent_access boolean := false;
  v_tasks jsonb := '[]'::jsonb;
  v_total integer := 0;
  v_completed integer := 0;
  v_next_step text := 'units';
  v_status text := 'pending_setup';
  v_blockers jsonb := '[]'::jsonb;
begin
  select c.* into v_community
  from public.communities c
  where c.id = p_community_id;

  if not found then
    return jsonb_build_object(
      'community_id', p_community_id,
      'onboarding_status', 'not_found',
      'next_step_key', 'not_found',
      'completed_tasks', 0,
      'total_tasks', 0,
      'tasks', '[]'::jsonb,
      'blockers', jsonb_build_array('Community not found')
    );
  end if;

  select cs.* into v_settings
  from public.community_settings cs
  where cs.community_id = p_community_id;

  select r.* into v_review
  from public.community_onboarding_reviews r
  where r.community_id = p_community_id;

  v_allow_reservations := coalesce(v_settings.allow_reservations, false);
  v_allow_messages := coalesce(v_settings.allow_messages, false);
  v_allow_frequent_access := coalesce(v_settings.allow_frequent_access, false);

  select count(*), count(*) filter (where h.is_active)
    into v_units_count, v_active_units_count
  from public.houses h
  where h.community_id = p_community_id;

  select
    count(*) filter (where cm.is_active and cm.role in ('ADMIN','SUPERADMIN')),
    count(*) filter (where cm.is_active)
    into v_admin_count, v_members_count
  from public.community_members cm
  where cm.community_id = p_community_id;

  select count(*), count(*) filter (where cf.is_active)
    into v_facilities_count, v_active_facilities_count
  from public.community_facilities cf
  where cf.community_id = p_community_id;

  select
    count(*),
    count(*) filter (where q.status = 'pending'),
    count(*) filter (where q.status = 'failed'),
    count(*) filter (where q.status = 'pin_generated'),
    count(*) filter (where q.status = 'activated')
    into v_queue_total, v_queue_pending, v_queue_failed, v_queue_pin_generated, v_queue_activated
  from public.resident_activation_queue q
  where q.community_id = p_community_id;

  v_details_done := nullif(trim(coalesce(v_community.name, '')), '') is not null
    and nullif(trim(coalesce(v_community.unit_label, '')), '') is not null;
  v_features_done := v_settings.community_id is not null;
  v_units_done := v_units_count > 0;
  v_admin_done := v_admin_count > 0;
  v_facilities_done := (not v_allow_reservations) or v_facilities_count > 0;
  v_activation_done := v_queue_total = 0
    or v_review.activation_queue_reviewed_at is not null
    or (v_queue_pending = 0 and v_queue_failed = 0);
  v_final_done := v_review.completed_at is not null and v_community.is_active = true;

  if not v_details_done then
    v_blockers := v_blockers || jsonb_build_array('Community details are incomplete');
  end if;
  if not v_features_done then
    v_blockers := v_blockers || jsonb_build_array('Feature settings are missing');
  end if;
  if not v_units_done then
    v_blockers := v_blockers || jsonb_build_array('At least one unit is required');
  end if;
  if not v_admin_done then
    v_blockers := v_blockers || jsonb_build_array('At least one active admin is required');
  end if;
  if not v_facilities_done then
    v_blockers := v_blockers || jsonb_build_array('Reservations are enabled but no facilities are configured');
  end if;
  if not v_activation_done then
    v_blockers := v_blockers || jsonb_build_array('Resident activation queue needs review');
  end if;

  v_tasks := jsonb_build_array(
    jsonb_build_object(
      'key', 'details',
      'label', 'Community details',
      'done', v_details_done,
      'required', true,
      'summary', jsonb_build_object('name', v_community.name, 'city', v_community.city, 'unit_label', v_community.unit_label)
    ),
    jsonb_build_object(
      'key', 'features',
      'label', 'Features configured',
      'done', v_features_done,
      'required', true,
      'summary', jsonb_build_object('allow_frequent_access', v_allow_frequent_access, 'allow_reservations', v_allow_reservations, 'allow_messages', v_allow_messages)
    ),
    jsonb_build_object(
      'key', 'units',
      'label', 'Units created',
      'done', v_units_done,
      'required', true,
      'summary', jsonb_build_object('total_units', v_units_count, 'active_units', v_active_units_count)
    ),
    jsonb_build_object(
      'key', 'admins',
      'label', 'Admin assigned',
      'done', v_admin_done,
      'required', true,
      'summary', jsonb_build_object('active_admins', v_admin_count, 'active_members', v_members_count)
    ),
    jsonb_build_object(
      'key', 'facilities',
      'label', 'Facilities configured',
      'done', v_facilities_done,
      'required', v_allow_reservations,
      'summary', jsonb_build_object('total_facilities', v_facilities_count, 'active_facilities', v_active_facilities_count)
    ),
    jsonb_build_object(
      'key', 'activation_queue',
      'label', 'Activation queue reviewed',
      'done', v_activation_done,
      'required', v_queue_total > 0,
      'summary', jsonb_build_object(
        'queue_total', v_queue_total,
        'pending', v_queue_pending,
        'failed', v_queue_failed,
        'pin_generated', v_queue_pin_generated,
        'activated', v_queue_activated,
        'reviewed_at', v_review.activation_queue_reviewed_at
      )
    ),
    jsonb_build_object(
      'key', 'final_review',
      'label', 'Final readiness check',
      'done', v_final_done,
      'required', true,
      'summary', jsonb_build_object('completed_at', v_review.completed_at, 'is_active', v_community.is_active)
    )
  );

  select count(*) into v_total
  from jsonb_array_elements(v_tasks);

  select count(*) into v_completed
  from jsonb_array_elements(v_tasks) t
  where coalesce((t->>'done')::boolean, false) = true;

  if not v_details_done then
    v_next_step := 'details';
  elsif not v_features_done then
    v_next_step := 'features';
  elsif not v_units_done then
    v_next_step := 'units';
  elsif not v_admin_done then
    v_next_step := 'staff';
  elsif not v_facilities_done then
    v_next_step := 'facilities';
  elsif not v_activation_done then
    v_next_step := 'review_activation_queue';
  elsif not v_final_done then
    v_next_step := 'final_review';
  else
    v_next_step := 'complete';
  end if;

  if v_final_done then
    v_status := 'complete_active';
  elsif jsonb_array_length(v_blockers) > 0 then
    v_status := 'pending_setup';
  else
    v_status := 'ready_for_final_review';
  end if;

  return jsonb_build_object(
    'community_id', p_community_id,
    'onboarding_status', v_status,
    'next_step_key', v_next_step,
    'completed_tasks', v_completed,
    'total_tasks', v_total,
    'tasks', v_tasks,
    'blockers', v_blockers,
    'metrics', jsonb_build_object(
      'total_units', v_units_count,
      'active_units', v_active_units_count,
      'active_admins', v_admin_count,
      'active_members', v_members_count,
      'total_facilities', v_facilities_count,
      'active_facilities', v_active_facilities_count,
      'activation_queue_total', v_queue_total,
      'activation_queue_pending', v_queue_pending,
      'activation_queue_failed', v_queue_failed,
      'activation_queue_pin_generated', v_queue_pin_generated,
      'activation_queue_activated', v_queue_activated
    ),
    'completed_at', v_review.completed_at,
    'activation_queue_reviewed_at', v_review.activation_queue_reviewed_at
  );
end;
$function$;
