-- Allow superadmins to correct a resident activation email safely before activation.
-- The operation is deliberately transactional: it invalidates outstanding credentials,
-- resets the queue lifecycle, and updates unsent campaign snapshots without touching
-- an already-created Auth identity.

create or replace function public.update_resident_activation_email_v1(
  p_community_id uuid,
  p_queue_id uuid,
  p_email text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_queue public.resident_activation_queue%rowtype;
  v_new_email text := nullif(lower(btrim(p_email)), '');
  v_reserved_queue_id uuid;
  v_existing_user_id uuid;
  v_previous_status text;
  v_pins_invalidated integer := 0;
  v_legacy_codes_invalidated integer := 0;
  v_campaign_messages_updated integer := 0;
  v_constraint text;
begin
  if not public.is_superadmin() then
    raise exception 'superadmin_required' using errcode = '42501';
  end if;

  if v_new_email is null
     or length(v_new_email) > 254
     or v_new_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('success', false, 'error', 'invalid_email');
  end if;

  -- Match the activation flow lock order: pending PIN first, then queue row.
  -- This prevents a resident activation racing an admin email correction from
  -- taking the same locks in reverse order.
  perform 1
    from public.resident_activation_pins
   where queue_id = p_queue_id
     and status = 'pending'
   order by id
   for update;

  select *
    into v_queue
    from public.resident_activation_queue
   where id = p_queue_id
     and community_id = p_community_id
   for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'queue_row_not_found');
  end if;

  if v_queue.status in ('activated', 'skipped') or v_queue.activated_user_id is not null then
    return jsonb_build_object(
      'success', false,
      'error', 'queue_row_terminal',
      'status', v_queue.status
    );
  end if;

  if nullif(lower(btrim(v_queue.email)), '') is not distinct from v_new_email then
    return jsonb_build_object(
      'success', true,
      'changed', false,
      'queue_id', v_queue.id,
      'email', v_new_email,
      'status', v_queue.status,
      'pins_invalidated', 0,
      'campaign_messages_updated', 0
    );
  end if;

  -- Coordinate with all other activation writers that reserve normalized email.
  perform pg_advisory_xact_lock(
    hashtextextended('entry-raq-email|' || v_new_email, 0)
  );

  select id
    into v_existing_user_id
    from auth.users
   where lower(btrim(email)) = v_new_email
   limit 1;

  if found then
    return jsonb_build_object(
      'success', false,
      'error', 'email_already_registered'
    );
  end if;

  select q.id
    into v_reserved_queue_id
    from public.resident_activation_queue q
   where q.id <> p_queue_id
     and lower(btrim(q.email)) = v_new_email
     and q.status in ('pending', 'invited', 'pin_generated', 'activated', 'failed')
   limit 1;

  if found then
    return jsonb_build_object(
      'success', false,
      'error', 'email_already_reserved'
    );
  end if;

  -- Lock any active campaign delivery row for this resident. If a worker already
  -- claimed it, do not change identity underneath an in-flight provider call.
  perform 1
    from public.onboarding_campaign_messages m
    join public.onboarding_campaigns c on c.id = m.campaign_id
   where m.activation_queue_id = p_queue_id
     and m.channel = 'email'
     and m.status in ('pending', 'processing')
     and c.status in ('running', 'paused')
   order by m.id
   for update of m;

  if exists (
    select 1
      from public.onboarding_campaign_messages m
      join public.onboarding_campaigns c on c.id = m.campaign_id
     where m.activation_queue_id = p_queue_id
       and m.channel = 'email'
       and m.status = 'processing'
       and c.status in ('running', 'paused')
  ) then
    return jsonb_build_object(
      'success', false,
      'error', 'campaign_send_in_progress'
    );
  end if;

  v_previous_status := v_queue.status;

  begin
    update public.resident_activation_queue
       set email = v_new_email,
           activation_method = 'email',
           suggested_username = null,
           status = 'pending',
           activation_code_id = null,
           invite_sent_at = null,
           processed_at = null,
           last_error = null,
           updated_at = now()
     where id = p_queue_id
       and community_id = p_community_id;
  exception
    when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;

      if v_constraint = 'ux_raq_live_email_identity' then
        return jsonb_build_object(
          'success', false,
          'error', 'email_already_reserved'
        );
      end if;

      raise;
  end;

  -- Only after the queue identity update succeeds do we invalidate credentials.
  -- Expected conflict returns above therefore have no side effects.
  update public.resident_activation_pins
     set status = 'expired',
         expires_at = least(expires_at, now())
   where queue_id = p_queue_id
     and status = 'pending';

  get diagnostics v_pins_invalidated = row_count;

  -- Defensive compatibility with the older activation-code path, if this queue
  -- row still references one.
  if v_queue.activation_code_id is not null then
    update public.account_activation_codes
       set status = 'expired',
           expires_at = least(expires_at, now()),
           visible_code = null
     where id = v_queue.activation_code_id
       and status = 'pending';

    get diagnostics v_legacy_codes_invalidated = row_count;
  end if;

  -- Campaign messages snapshot the destination email. Only unsent rows are
  -- rewritten; sent/failed rows remain immutable history.
  update public.onboarding_campaign_messages m
     set recipient_email = v_new_email,
         updated_at = now()
   where m.activation_queue_id = p_queue_id
     and m.channel = 'email'
     and m.status = 'pending'
     and exists (
       select 1
         from public.onboarding_campaigns c
        where c.id = m.campaign_id
          and c.status in ('running', 'paused')
     );

  get diagnostics v_campaign_messages_updated = row_count;

  perform public._sa_audit_log(
    'update_resident_activation_email_v1',
    'resident_activation_queue',
    p_queue_id,
    jsonb_build_object(
      'community_id', p_community_id,
      'previous_status', v_previous_status,
      'new_status', 'pending',
      'pins_invalidated', v_pins_invalidated,
      'legacy_codes_invalidated', v_legacy_codes_invalidated,
      'campaign_messages_updated', v_campaign_messages_updated
    )
  );

  return jsonb_build_object(
    'success', true,
    'changed', true,
    'queue_id', p_queue_id,
    'email', v_new_email,
    'previous_status', v_previous_status,
    'status', 'pending',
    'pins_invalidated', v_pins_invalidated,
    'legacy_codes_invalidated', v_legacy_codes_invalidated,
    'campaign_messages_updated', v_campaign_messages_updated
  );
end;
$function$;

-- Console PIN generation must serialize with email correction. The existing
-- generator is kept as the canonical implementation; this wrapper only acquires
-- locks in the same order used by activation completion and the email editor.
create or replace function public.generate_resident_activation_pins_locked_v1(
  p_community_id uuid,
  p_queue_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
begin
  if not public.is_superadmin() then
    raise exception 'superadmin_required' using errcode = '42501';
  end if;

  if p_queue_ids is null or cardinality(p_queue_ids) = 0 then
    return jsonb_build_object(
      'generated_count', 0,
      'skipped_count', 0,
      'failed_count', 0,
      'items', '[]'::jsonb
    );
  end if;

  -- Complete activation locks PIN -> queue. Keep the same order here, and lock
  -- IDs deterministically for batch requests to avoid cross-batch deadlocks.
  perform 1
    from public.resident_activation_pins
   where queue_id = any(p_queue_ids)
     and status = 'pending'
   order by queue_id, id
   for update;

  perform 1
    from public.resident_activation_queue
   where id = any(p_queue_ids)
   order by id
   for update;

  return public.generate_resident_activation_pins_v1(
    p_community_id,
    p_queue_ids
  );
end;
$function$;

comment on function public.generate_resident_activation_pins_locked_v1(uuid, uuid[]) is
  'Console-safe wrapper around generate_resident_activation_pins_v1. Serializes '
  'pending PIN and queue-row locks so PIN generation cannot read a stale email '
  'while a superadmin corrects the activation identity.';

revoke all on function public.generate_resident_activation_pins_locked_v1(uuid, uuid[]) from public;
revoke all on function public.generate_resident_activation_pins_locked_v1(uuid, uuid[]) from anon;
grant execute on function public.generate_resident_activation_pins_locked_v1(uuid, uuid[]) to authenticated;

comment on function public.update_resident_activation_email_v1(uuid, uuid, text) is
  'Superadmin-only pre-activation email correction. Rejects activated/skipped rows, '
  'reserves normalized email globally, invalidates pending activation credentials, '
  'resets the queue row to pending, and updates unsent active-campaign recipient snapshots. '
  'Does not modify auth.users or already-sent campaign history.';

revoke all on function public.update_resident_activation_email_v1(uuid, uuid, text) from public;
revoke all on function public.update_resident_activation_email_v1(uuid, uuid, text) from anon;
grant execute on function public.update_resident_activation_email_v1(uuid, uuid, text) to authenticated;
