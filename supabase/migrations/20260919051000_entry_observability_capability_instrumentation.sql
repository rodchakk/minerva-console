-- ENTRY-OBS-006: capability-level instrumentation for ENTRY observability.
--
-- Adds durable success/failure signals for capability categories without logging
-- credentials, PINs, QR values, visitor names, recipient addresses, or payloads.

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

  for v_row in
    select distinct cm.community_id, cm.role::text as membership_role
    from public.community_members cm
    where cm.user_id = NEW.id
      and cm.is_active = true
      and cm.role in ('RESIDENT', 'ADMIN', 'GUARD')
  loop
    begin
      perform public.log_system_event(
        'INFO',
        'authentication',
        'AUTH_LOGIN',
        'ENTRY sign-in completed',
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
      null;
    end;
  end loop;

  return NEW;
exception when others then
  return NEW;
end;
$function$;

comment on function public._entry_obs_resident_login_v1() is
  'Best-effort Authentication capability telemetry for active resident, admin, and guard community memberships.';

create or replace function public._entry_obs_visit_group_created_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  begin
    perform public.log_system_event(
      'INFO',
      'resident_access',
      'VISIT_GROUP_CREATED',
      'Resident visit group created',
      jsonb_strip_nulls(jsonb_build_object(
        'status', 'success',
        'group_type', NEW.group_type,
        'capacity', NEW.capacity
      )),
      NEW.community_id,
      NEW.created_by,
      NEW.created_by,
      'visit_group',
      NEW.id,
      'entry_flow_trigger',
      NEW.id::text
    );
  exception when others then
    null;
  end;

  return NEW;
end;
$function$;

drop trigger if exists trg_entry_obs_visit_group_created_v1
  on public.visit_groups;

create trigger trg_entry_obs_visit_group_created_v1
after insert on public.visit_groups
for each row
execute function public._entry_obs_visit_group_created_v1();

comment on function public._entry_obs_visit_group_created_v1() is
  'Best-effort Resident access success telemetry for visit groups.';

create or replace function public._entry_obs_frequent_access_created_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  begin
    perform public.log_system_event(
      'INFO',
      'resident_access',
      'FREQUENT_ACCESS_CREATED',
      'Frequent access authorization created',
      jsonb_build_object(
        'status', 'success',
        'schedule_type', NEW.access_schedule_type
      ),
      NEW.community_id,
      NEW.created_by,
      NEW.created_by,
      'authorized_frequent_visitor',
      NEW.id,
      'entry_flow_trigger',
      NEW.id::text
    );
  exception when others then
    null;
  end;

  return NEW;
end;
$function$;

drop trigger if exists trg_entry_obs_frequent_access_created_v1
  on public.authorized_frequent_visitors;

create trigger trg_entry_obs_frequent_access_created_v1
after insert on public.authorized_frequent_visitors
for each row
execute function public._entry_obs_frequent_access_created_v1();

comment on function public._entry_obs_frequent_access_created_v1() is
  'Best-effort Resident access success telemetry for frequent-access authorizations.';

create or replace function public._entry_obs_activation_outcome_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if NEW.status is not distinct from OLD.status then
    return NEW;
  end if;

  if NEW.status not in ('activated', 'failed') then
    return NEW;
  end if;

  begin
    perform public.log_system_event(
      case when NEW.status = 'failed' then 'ERROR' else 'INFO' end,
      'onboarding',
      case
        when NEW.status = 'activated' then 'ONBOARDING_ACTIVATED'
        else 'ONBOARDING_ACTIVATION_FAILED'
      end,
      case
        when NEW.status = 'activated' then 'Resident onboarding activation completed'
        else 'Resident onboarding activation failed'
      end,
      jsonb_strip_nulls(jsonb_build_object(
        'status', case when NEW.status = 'activated' then 'success' else 'failed' end,
        'error_code', case when NEW.status = 'failed' then 'ONBOARDING_ACTIVATION_FAILED' else null end,
        'activation_method', NEW.activation_method
      )),
      NEW.community_id,
      NEW.activated_user_id,
      auth.uid(),
      'resident_activation_queue',
      NEW.id,
      'activation_queue_trigger',
      NEW.id::text
    );
  exception when others then
    null;
  end;

  return NEW;
end;
$function$;

drop trigger if exists trg_entry_obs_activation_outcome_v1
  on public.resident_activation_queue;

create trigger trg_entry_obs_activation_outcome_v1
after update of status on public.resident_activation_queue
for each row
when (NEW.status is distinct from OLD.status)
execute function public._entry_obs_activation_outcome_v1();

comment on function public._entry_obs_activation_outcome_v1() is
  'Best-effort Onboarding capability outcome telemetry. Stores no activation PIN, recipient address, or registration payload.';
