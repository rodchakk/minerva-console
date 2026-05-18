-- ─────────────────────────────────────────────────────────────────────────────
-- Allow 'invited' queue status in validate/complete activation flows
--
-- Original v1 functions only accepted queue rows in 'pin_generated' or 'failed'
-- status. But after sending an activation email the queue row is moved to
-- 'invited' — which is precisely the state in which users will click the email
-- link and try to activate. Without this fix, every email-based activation
-- returns "queue_not_eligible" and looks like an invalid link.
--
-- This migration replaces the two RPCs to also allow 'invited' as a valid
-- pre-activation state. Terminal statuses ('activated', 'skipped') remain
-- blocked.
-- ─────────────────────────────────────────────────────────────────────────────


create or replace function public.validate_resident_activation_pin_v1(
  p_pin text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_pin_clean      text;
  v_identifier     text;
  v_attempts       int;
  v_recent_limited int;
  v_pin_row        public.resident_activation_pins%rowtype;
  v_queue_row      public.resident_activation_queue%rowtype;
  v_community_name text;
begin

  v_pin_clean := trim(coalesce(p_pin, ''));

  if v_pin_clean !~ '^[0-9]{6}$' then
    return jsonb_build_object('valid', false, 'reason', 'invalid');
  end if;

  v_identifier := 'rap_validate:' || v_pin_clean;

  select count(*) into v_attempts
  from public.security_event_log
  where event_type = 'VALIDATE_RESIDENT_ACTIVATION_PIN'
    and identifier  = v_identifier
    and created_at  >= now() - interval '10 minutes';

  if v_attempts >= 10 then
    select count(*) into v_recent_limited
    from public.security_event_log
    where event_type = 'VALIDATE_RESIDENT_ACTIVATION_PIN'
      and identifier  = v_identifier
      and success     = false
      and metadata->>'reason' = 'rate_limited'
      and created_at  >= now() - interval '5 minutes';

    if v_recent_limited = 0 then
      insert into public.security_event_log
        (user_id, event_type, identifier, success, metadata)
      values
        (auth.uid(), 'VALIDATE_RESIDENT_ACTIVATION_PIN', v_identifier, false,
         jsonb_build_object('reason', 'rate_limited'));
    end if;

    return jsonb_build_object('valid', false, 'reason', 'too_many_attempts');
  end if;

  select *
  into v_pin_row
  from public.resident_activation_pins
  where status    = 'pending'
    and expires_at > now()
    and extensions.crypt(v_pin_clean, pin_hash) = pin_hash
  order by created_at desc
  limit 1;

  if v_pin_row.id is null then
    insert into public.security_event_log
      (user_id, event_type, identifier, success, metadata)
    values
      (auth.uid(), 'VALIDATE_RESIDENT_ACTIVATION_PIN', v_identifier, false,
       jsonb_build_object('reason', 'not_found_or_invalid'));

    return jsonb_build_object('valid', false, 'reason', 'invalid');
  end if;

  select *
  into v_queue_row
  from public.resident_activation_queue
  where id = v_pin_row.queue_id;

  if not found then
    insert into public.security_event_log
      (user_id, event_type, identifier, success, metadata)
    values
      (auth.uid(), 'VALIDATE_RESIDENT_ACTIVATION_PIN', v_identifier, false,
       jsonb_build_object('reason', 'queue_row_missing'));

    return jsonb_build_object('valid', false, 'reason', 'queue_not_eligible');
  end if;

  -- Queue must be in a pre-activation state. 'invited' is included here
  -- because email-based activations move the row to 'invited' after the
  -- invitation email is sent — that is exactly the state in which the user
  -- will click the email link and try to activate.
  if v_queue_row.status not in ('pin_generated', 'failed', 'invited') then
    insert into public.security_event_log
      (user_id, event_type, identifier, success, metadata)
    values
      (auth.uid(), 'VALIDATE_RESIDENT_ACTIVATION_PIN', v_identifier, false,
       jsonb_build_object('reason', 'queue_status_ineligible',
                          'queue_status', v_queue_row.status));

    return jsonb_build_object(
      'valid',  false,
      'reason', case
                  when v_queue_row.status = 'activated' then 'already_activated'
                  else 'queue_not_eligible'
                end
    );
  end if;

  select name into v_community_name
  from public.communities
  where id = v_pin_row.community_id;

  insert into public.security_event_log
    (user_id, event_type, identifier, success, metadata)
  values
    (auth.uid(), 'VALIDATE_RESIDENT_ACTIVATION_PIN', v_identifier, true,
     jsonb_build_object(
       'pin_id',       v_pin_row.id,
       'queue_id',     v_queue_row.id,
       'community_id', v_pin_row.community_id
     ));

  return jsonb_build_object(
    'valid',              true,
    'activation_type',    'resident_queue_pin',
    'pin_id',             v_pin_row.id,
    'queue_id',           v_queue_row.id,
    'resident_name',      v_queue_row.resident_name,
    'unit_label',         v_queue_row.unit_label,
    'community_name',     coalesce(v_community_name, 'Comunidad'),
    'community_id',       v_pin_row.community_id,
    'suggested_username', v_queue_row.suggested_username,
    'activation_method',  v_queue_row.activation_method,
    'masked_email',       public.mask_email(v_queue_row.email),
    'masked_phone',       public.mask_phone(v_queue_row.phone),
    'expires_at',         v_pin_row.expires_at
  );
end;
$function$;


-- complete_resident_activation_pin_v1 already implicitly allows 'invited'
-- because it only hard-blocks 'activated' and 'skipped'. No changes needed
-- there.
