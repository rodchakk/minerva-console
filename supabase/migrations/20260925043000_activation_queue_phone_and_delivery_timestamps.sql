-- Activation Queue contact corrections + delivery visibility.
--
-- 1) Adds a safe superadmin-only phone correction RPC for pre-activation rows.
-- 2) Adds list_resident_activation_queue_v2 so Console can show the most recent
--    PIN generation time alongside the existing invite_sent_at timestamp.

create or replace function public.update_resident_activation_phone_v1(
  p_community_id uuid,
  p_queue_id uuid,
  p_phone text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_queue public.resident_activation_queue%rowtype;
  v_new_phone text := nullif(btrim(p_phone), '');
  v_phone_digits text;
  v_new_method text;
  v_previous_status text;
  v_requires_reset boolean := false;
  v_pins_invalidated integer := 0;
  v_legacy_codes_invalidated integer := 0;
  v_campaign_messages_updated integer := 0;
begin
  if not public.is_superadmin() then
    raise exception 'superadmin_required' using errcode = '42501';
  end if;

  if v_new_phone is null or length(v_new_phone) > 32 then
    return jsonb_build_object('success', false, 'error', 'invalid_phone');
  end if;

  if v_new_phone !~ '^\+?[0-9][0-9() .-]*$' then
    return jsonb_build_object('success', false, 'error', 'invalid_phone');
  end if;

  v_phone_digits := regexp_replace(v_new_phone, '[^0-9]', '', 'g');

  if length(v_phone_digits) < 7 or length(v_phone_digits) > 15 then
    return jsonb_build_object('success', false, 'error', 'invalid_phone');
  end if;

  -- Keep the same lock order used by activation completion and the email editor.
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

  if nullif(btrim(v_queue.phone), '') is not distinct from v_new_phone then
    return jsonb_build_object(
      'success', true,
      'changed', false,
      'queue_id', v_queue.id,
      'phone', v_new_phone,
      'activation_method', v_queue.activation_method,
      'status', v_queue.status,
      'activation_reset', false,
      'pins_invalidated', 0,
      'campaign_messages_updated', 0
    );
  end if;

  -- Correcting a phone should not silently change an already-selected
  -- activation method. Only derive one for legacy/unconfigured rows.
  v_new_method := v_queue.activation_method;

  if v_new_method is null
     or v_new_method not in ('email', 'phone_pin', 'username_pin') then
    if v_queue.email is not null
       and v_queue.email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      v_new_method := 'email';
    else
      v_new_method := 'phone_pin';
    end if;
  end if;

  -- A PIN delivered to an old phone must not remain usable. Email/username
  -- activation is preserved because the corrected phone is not that credential.
  v_requires_reset := v_new_method = 'phone_pin';

  -- Future SMS/WhatsApp campaigns may snapshot recipient_phone. Never mutate
  -- that contact while a worker is already processing it.
  perform 1
    from public.onboarding_campaign_messages m
    join public.onboarding_campaigns c on c.id = m.campaign_id
   where m.activation_queue_id = p_queue_id
     and m.channel in ('sms', 'whatsapp')
     and m.status in ('pending', 'processing')
     and c.status in ('running', 'paused')
   order by m.id
   for update of m;

  if exists (
    select 1
      from public.onboarding_campaign_messages m
      join public.onboarding_campaigns c on c.id = m.campaign_id
     where m.activation_queue_id = p_queue_id
       and m.channel in ('sms', 'whatsapp')
       and m.status = 'processing'
       and c.status in ('running', 'paused')
  ) then
    return jsonb_build_object(
      'success', false,
      'error', 'phone_send_in_progress'
    );
  end if;

  v_previous_status := v_queue.status;

  update public.resident_activation_queue
     set phone = v_new_phone,
         activation_method = v_new_method,
         status = case when v_requires_reset then 'pending' else status end,
         activation_code_id = case when v_requires_reset then null else activation_code_id end,
         invite_sent_at = case when v_requires_reset then null else invite_sent_at end,
         processed_at = case when v_requires_reset then null else processed_at end,
         last_error = case when v_requires_reset then null else last_error end,
         updated_at = now()
   where id = p_queue_id
     and community_id = p_community_id;

  if v_requires_reset then
    update public.resident_activation_pins
       set status = 'expired',
           expires_at = least(expires_at, now())
     where queue_id = p_queue_id
       and status = 'pending';

    get diagnostics v_pins_invalidated = row_count;

    if v_queue.activation_code_id is not null then
      update public.account_activation_codes
         set status = 'expired',
             expires_at = least(expires_at, now()),
             visible_code = null
       where id = v_queue.activation_code_id
         and status = 'pending';

      get diagnostics v_legacy_codes_invalidated = row_count;
    end if;
  end if;

  update public.onboarding_campaign_messages m
     set recipient_phone = v_new_phone,
         updated_at = now()
   where m.activation_queue_id = p_queue_id
     and m.channel in ('sms', 'whatsapp')
     and m.status = 'pending'
     and exists (
       select 1
         from public.onboarding_campaigns c
        where c.id = m.campaign_id
          and c.status in ('running', 'paused')
     );

  get diagnostics v_campaign_messages_updated = row_count;

  perform public._sa_audit_log(
    'update_resident_activation_phone_v1',
    'resident_activation_queue',
    p_queue_id,
    jsonb_build_object(
      'community_id', p_community_id,
      'previous_status', v_previous_status,
      'new_status', case when v_requires_reset then 'pending' else v_previous_status end,
      'previous_method', v_queue.activation_method,
      'new_method', v_new_method,
      'activation_reset', v_requires_reset,
      'pins_invalidated', v_pins_invalidated,
      'legacy_codes_invalidated', v_legacy_codes_invalidated,
      'campaign_messages_updated', v_campaign_messages_updated
    )
  );

  return jsonb_build_object(
    'success', true,
    'changed', true,
    'queue_id', p_queue_id,
    'phone', v_new_phone,
    'previous_status', v_previous_status,
    'status', case when v_requires_reset then 'pending' else v_previous_status end,
    'activation_method', v_new_method,
    'activation_reset', v_requires_reset,
    'pins_invalidated', v_pins_invalidated,
    'legacy_codes_invalidated', v_legacy_codes_invalidated,
    'campaign_messages_updated', v_campaign_messages_updated
  );
end;
$function$;

comment on function public.update_resident_activation_phone_v1(uuid, uuid, text) is
  'Superadmin-only pre-activation phone correction. Preserves email/username activation state, '
  'but invalidates pending credentials and resets to Pending whenever phone PIN '
  'activation is involved. Updates unsent SMS/WhatsApp campaign snapshots and never '
  'modifies an already-created Auth identity.';

revoke all on function public.update_resident_activation_phone_v1(uuid, uuid, text) from public;
revoke all on function public.update_resident_activation_phone_v1(uuid, uuid, text) from anon;
grant execute on function public.update_resident_activation_phone_v1(uuid, uuid, text) to authenticated;


create or replace function public.list_resident_activation_queue_v2(
  p_community_id uuid,
  p_status text default null
)
returns table(
  id uuid,
  community_id uuid,
  house_id uuid,
  unit_label text,
  resident_name text,
  phone text,
  email text,
  is_owner_reference boolean,
  suggested_username text,
  activation_method text,
  status text,
  invite_sent_at timestamptz,
  last_pin_generated_at timestamptz,
  processed_at timestamptz,
  last_error text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_superadmin() then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  return query
  select
    q.id,
    q.community_id,
    q.house_id,
    q.unit_label,
    q.resident_name,
    q.phone,
    q.email,
    q.is_owner_reference,
    q.suggested_username,
    q.activation_method,
    q.status,
    q.invite_sent_at,
    pins.last_pin_generated_at,
    q.processed_at,
    q.last_error,
    q.created_at
  from public.resident_activation_queue q
  left join lateral (
    select max(p.created_at) as last_pin_generated_at
      from public.resident_activation_pins p
     where p.queue_id = q.id
  ) pins on true
  where q.community_id = p_community_id
    and (p_status is null or q.status = p_status)
  order by q.created_at asc;
end;
$function$;

comment on function public.list_resident_activation_queue_v2(uuid, text) is
  'Superadmin Activation Queue listing with invite_sent_at plus the latest PIN '
  'generation timestamp. Exposes timing metadata only; never exposes PIN values or hashes.';

revoke all on function public.list_resident_activation_queue_v2(uuid, text) from public;
revoke all on function public.list_resident_activation_queue_v2(uuid, text) from anon;
grant execute on function public.list_resident_activation_queue_v2(uuid, text) to authenticated;
grant execute on function public.list_resident_activation_queue_v2(uuid, text) to service_role;
