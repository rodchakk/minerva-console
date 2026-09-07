-- Recompute completion from current answers at submit time and avoid showing
-- 100% while a non-empty email is malformed.
create or replace function public._outrider_complete_sections_v2(
  p_unit_types text[],
  p_unit_type_other text,
  p_unit_naming_example text,
  p_has_destinations boolean,
  p_destinations text[],
  p_has_inactive_units boolean,
  p_inactive_units_notes text,
  p_security_staff_count integer,
  p_contact_name text,
  p_contact_phone text,
  p_contact_email text
)
returns text[]
language plpgsql
set search_path = ''
as $function$
declare
  v_sections text[] := '{}'::text[];
  v_email_present boolean := false;
  v_email_valid boolean := false;
begin
  if cardinality(coalesce(p_unit_types, '{}'::text[])) > 0
     and nullif(btrim(coalesce(p_unit_naming_example, '')), '') is not null
     and (
       'otro' <> all(coalesce(p_unit_types, '{}'::text[]))
       or nullif(btrim(coalesce(p_unit_type_other, '')), '') is not null
     ) then
    v_sections := array_append(v_sections, 'units');
  end if;

  if p_has_destinations = false
     or (p_has_destinations = true and cardinality(coalesce(p_destinations, '{}'::text[])) > 0) then
    v_sections := array_append(v_sections, 'destinations');
  end if;

  if p_has_inactive_units = false
     or (
       p_has_inactive_units = true
       and nullif(btrim(coalesce(p_inactive_units_notes, '')), '') is not null
     ) then
    v_sections := array_append(v_sections, 'inactive_units');
  end if;

  if p_security_staff_count is not null then
    v_sections := array_append(v_sections, 'available_information');
  end if;

  v_email_present := nullif(btrim(coalesce(p_contact_email, '')), '') is not null;
  v_email_valid :=
    v_email_present
    and p_contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$';

  if nullif(btrim(coalesce(p_contact_name, '')), '') is not null
     and (
       nullif(btrim(coalesce(p_contact_phone, '')), '') is not null
       or v_email_valid
     )
     and (not v_email_present or v_email_valid) then
    v_sections := array_append(v_sections, 'contact');
  end if;

  return v_sections;
end;
$function$;

create or replace function public.submit_community_outrider_v1(
  p_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_outrider public.community_outrider_sessions%rowtype;
  v_completed_sections text[];
begin
  perform public._outrider_service_role_only_v1();

  select * into v_outrider
    from public.community_outrider_sessions
   where token_hash = btrim(coalesce(p_token_hash, ''))
   for update;

  if not found then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_UNAVAILABLE', '42501');
  end if;

  if v_outrider.status in ('ready_for_review', 'approved') then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_READ_ONLY', 'P0409');
  end if;

  v_completed_sections := public._outrider_complete_sections_v2(
    v_outrider.unit_types,
    v_outrider.unit_type_other,
    v_outrider.unit_naming_example,
    v_outrider.has_destinations,
    v_outrider.destinations,
    v_outrider.has_inactive_units,
    v_outrider.inactive_units_notes,
    v_outrider.security_staff_count,
    v_outrider.contact_name,
    v_outrider.contact_phone,
    v_outrider.contact_email
  );

  if cardinality(v_completed_sections) <> 5 then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_INCOMPLETE', 'P0409');
  end if;

  if v_outrider.contact_email is not null
     and v_outrider.contact_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_PAYLOAD', 'P0409');
  end if;

  update public.community_outrider_sessions
     set status = 'ready_for_review',
         completed_sections = v_completed_sections,
         submitted_at = now(),
         last_activity_at = now()
   where id = v_outrider.id
   returning * into v_outrider;

  insert into public.community_outrider_events (
    outrider_id,
    community_id,
    event_type,
    actor_type,
    metadata
  )
  values (
    v_outrider.id,
    v_outrider.community_id,
    'outrider_submitted',
    'public_token',
    jsonb_build_object('progress_percent', 100)
  );

  return jsonb_build_object(
    'accepted', true,
    'status', v_outrider.status,
    'completed_sections', v_outrider.completed_sections,
    'progress_percent', 100,
    'submitted_at', v_outrider.submitted_at
  );
end;
$function$;
