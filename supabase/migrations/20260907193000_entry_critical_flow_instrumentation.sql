-- ENTRY-OBS-002: Critical flow instrumentation.
--
-- Emits privacy-minimized operational events from durable sources that already
-- represent successful ENTRY business outcomes. Observability is best-effort:
-- telemetry must never break passes, QR resolution, login, or push delivery.
--
-- Important health semantics:
-- - A rejected/unknown QR is still a successful execution of the QR validator.
--   It is recorded as status=success with result=rejected, not as a system
--   failure. This avoids turning normal security/business rejections into
--   false outages.
-- - Missing traffic remains Unknown in Observability. No heartbeat is invented.
-- - No pass PIN/QR token, email, push body/title, image, or other user content is
--   copied into system_event_log.

create or replace function public._entry_obs_pass_created_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  begin
    perform public.log_system_event(
      'INFO',
      'passes',
      'PASS_CREATED',
      'Access pass created',
      jsonb_build_object(
        'status', 'success',
        'pass_type', NEW.pass_type::text,
        'initial_status', NEW.status::text
      ),
      NEW.community_id,
      NEW.created_by,
      NEW.created_by,
      'visit_pass',
      NEW.id,
      'entry_flow_trigger',
      NEW.id::text
    );
  exception when others then
    -- Observability must never block pass creation.
    null;
  end;

  return NEW;
end;
$function$;

revoke all on function public._entry_obs_pass_created_v1() from public, anon, authenticated;

drop trigger if exists trg_entry_obs_pass_created_v1 on public.visit_passes;
create trigger trg_entry_obs_pass_created_v1
after insert on public.visit_passes
for each row
execute function public._entry_obs_pass_created_v1();

create or replace function public._entry_obs_qr_resolution_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_community_id uuid;
  v_community_text text;
  v_reason text;
  v_result text;
begin
  if NEW.event_type <> 'RESOLVE_ACCESS_CREDENTIAL'
     or upper(coalesce(NEW.metadata->>'method', '')) <> 'QR' then
    return NEW;
  end if;

  v_community_text := nullif(btrim(coalesce(NEW.metadata->>'community_id', '')), '');
  if v_community_text is not null
     and v_community_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    v_community_id := v_community_text::uuid;
  end if;

  v_reason := nullif(btrim(coalesce(NEW.metadata->>'reason', '')), '');
  v_result := case when coalesce(NEW.success, false) then 'accepted' else 'rejected' end;

  begin
    perform public.log_system_event(
      'INFO',
      'access',
      'QR_VALIDATED',
      case
        when v_result = 'accepted' then 'QR validation completed'
        else 'QR validation completed with rejection'
      end,
      jsonb_strip_nulls(jsonb_build_object(
        'status', 'success',
        'result', v_result,
        'reason', v_reason
      )),
      v_community_id,
      NEW.user_id,
      NEW.user_id,
      'security_event',
      NEW.id,
      'entry_flow_trigger',
      NEW.id::text
    );
  exception when others then
    -- A logging failure must never alter credential-resolution behavior.
    null;
  end;

  return NEW;
end;
$function$;

revoke all on function public._entry_obs_qr_resolution_v1() from public, anon, authenticated;

drop trigger if exists trg_entry_obs_qr_resolution_v1 on public.security_event_log;
create trigger trg_entry_obs_qr_resolution_v1
after insert on public.security_event_log
for each row
when (
  NEW.event_type = 'RESOLVE_ACCESS_CREDENTIAL'
  and upper(coalesce(NEW.metadata->>'method', '')) = 'QR'
)
execute function public._entry_obs_qr_resolution_v1();

create or replace function public._entry_obs_resident_login_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_row record;
begin
  if NEW.last_sign_in_at is null
     or NEW.last_sign_in_at is not distinct from OLD.last_sign_in_at then
    return NEW;
  end if;

  -- A resident-capable app user is defined by an active unit assignment plus
  -- an active RESIDENT/ADMIN community membership. This prevents staff-only
  -- logins from making the resident-login flow look healthy.
  for v_row in
    select distinct cm.community_id, cm.role::text as membership_role
    from public.community_members cm
    join public.house_residents hr
      on hr.user_id = cm.user_id
     and hr.community_id = cm.community_id
     and hr.is_active = true
    where cm.user_id = NEW.id
      and cm.is_active = true
      and cm.role in ('RESIDENT', 'ADMIN')
  loop
    begin
      perform public.log_system_event(
        'INFO',
        'auth',
        'RESIDENT_LOGIN',
        'Resident sign-in completed',
        jsonb_build_object(
          'status', 'success',
          'membership_role', v_row.membership_role
        ),
        v_row.community_id,
        NEW.id,
        NEW.id,
        'auth_user',
        NEW.id,
        'auth_trigger',
        concat(NEW.id::text, ':', extract(epoch from NEW.last_sign_in_at)::bigint::text)
      );
    exception when others then
      -- Auth must remain available even if telemetry is unavailable.
      null;
    end;
  end loop;

  return NEW;
exception when others then
  -- Never make a Supabase Auth sign-in fail because of observability.
  return NEW;
end;
$function$;

revoke all on function public._entry_obs_resident_login_v1() from public, anon, authenticated;

drop trigger if exists trg_entry_obs_resident_login_v1 on auth.users;
create trigger trg_entry_obs_resident_login_v1
after update of last_sign_in_at on auth.users
for each row
when (
  NEW.last_sign_in_at is not null
  and NEW.last_sign_in_at is distinct from OLD.last_sign_in_at
)
execute function public._entry_obs_resident_login_v1();

create or replace function public._entry_obs_push_outcome_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_failed boolean := lower(coalesce(NEW.status, '')) = 'failed';
begin
  if lower(coalesce(NEW.status, '')) not in ('sent', 'failed') then
    return NEW;
  end if;

  begin
    perform public.log_system_event(
      case when v_failed then 'ERROR' else 'INFO' end,
      'notifications',
      case when v_failed then 'NOTIFICATION_FAILED' else 'NOTIFICATION_SENT' end,
      case when v_failed then 'Community push delivery failed' else 'Community push delivery completed' end,
      jsonb_strip_nulls(jsonb_build_object(
        'status', case when v_failed then 'failed' else 'success' end,
        'attempts', NEW.attempts,
        'enqueue_source', nullif(NEW.enqueue_source, ''),
        'error_code', case when v_failed then 'PUSH_DELIVERY_FAILED' else null end
      )),
      NEW.community_id,
      null,
      NEW.enqueued_by,
      'community_message_push',
      NEW.id,
      'push_queue_trigger',
      NEW.id::text
    );
  exception when others then
    -- Push completion/failure state is the source of truth; telemetry is not.
    null;
  end;

  return NEW;
end;
$function$;

revoke all on function public._entry_obs_push_outcome_v1() from public, anon, authenticated;

drop trigger if exists trg_entry_obs_push_outcome_insert_v1 on public.community_message_push_queue;
create trigger trg_entry_obs_push_outcome_insert_v1
after insert on public.community_message_push_queue
for each row
when (lower(coalesce(NEW.status, '')) in ('sent', 'failed'))
execute function public._entry_obs_push_outcome_v1();

drop trigger if exists trg_entry_obs_push_outcome_update_v1 on public.community_message_push_queue;
create trigger trg_entry_obs_push_outcome_update_v1
after update of status on public.community_message_push_queue
for each row
when (
  lower(coalesce(NEW.status, '')) in ('sent', 'failed')
  and NEW.status is distinct from OLD.status
)
execute function public._entry_obs_push_outcome_v1();
