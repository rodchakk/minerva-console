-- Collect the first ENTRY administrators during Outrider so Minerva can prepare
-- their activations first. No live ENTRY operational records are created here.

alter table public.community_outrider_sessions
  add column if not exists initial_admin_count integer,
  add column if not exists initial_admins jsonb not null default '[]'::jsonb;

alter table public.community_outrider_sessions
  drop constraint if exists community_outrider_sessions_initial_admin_count_check;
alter table public.community_outrider_sessions
  add constraint community_outrider_sessions_initial_admin_count_check
  check (initial_admin_count is null or initial_admin_count between 0 and 25);

alter table public.community_outrider_sessions
  drop constraint if exists community_outrider_sessions_initial_admins_check;
alter table public.community_outrider_sessions
  add constraint community_outrider_sessions_initial_admins_check
  check (
    jsonb_typeof(initial_admins) = 'array'
    and jsonb_array_length(initial_admins) <= 25
  );

create or replace function public._outrider_initial_admins_complete_v1(
  p_count integer,
  p_admins jsonb
)
returns boolean
language plpgsql
set search_path = ''
as $function$
declare
  v_admin jsonb;
  v_name text;
  v_unit text;
  v_phone text;
  v_email text;
begin
  if p_count is null or p_count < 0 or p_count > 25 then
    return false;
  end if;

  if p_admins is null
     or jsonb_typeof(p_admins) <> 'array'
     or jsonb_array_length(p_admins) <> p_count then
    return false;
  end if;

  for v_admin in select value from jsonb_array_elements(p_admins)
  loop
    if jsonb_typeof(v_admin) <> 'object' then
      return false;
    end if;

    v_name := nullif(btrim(coalesce(v_admin ->> 'name', '')), '');
    v_unit := nullif(btrim(coalesce(v_admin ->> 'unit', '')), '');
    v_phone := nullif(btrim(coalesce(v_admin ->> 'phone', '')), '');
    v_email := nullif(lower(btrim(coalesce(v_admin ->> 'email', ''))), '');

    if v_name is null
       or v_unit is null
       or (v_phone is null and v_email is null)
       or (v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
      return false;
    end if;
  end loop;

  return true;
end;
$function$;

revoke all on function public._outrider_initial_admins_complete_v1(integer, jsonb)
  from public, anon, authenticated;
grant execute on function public._outrider_initial_admins_complete_v1(integer, jsonb)
  to service_role;

-- Preserve the already-hardened implementations as narrow base functions and
-- wrap them with the new administrator persistence/validation.
alter function public.save_community_outrider_v1(text, jsonb, text[])
  rename to _save_community_outrider_without_admins_v1;
alter function public.submit_community_outrider_v1(text)
  rename to _submit_community_outrider_without_admins_v1;
alter function public.resolve_community_outrider_v1(text)
  rename to _resolve_community_outrider_without_admins_v1;

revoke all on function public._save_community_outrider_without_admins_v1(text, jsonb, text[])
  from public, anon, authenticated;
revoke all on function public._submit_community_outrider_without_admins_v1(text)
  from public, anon, authenticated;
revoke all on function public._resolve_community_outrider_without_admins_v1(text)
  from public, anon, authenticated;

create or replace function public.save_community_outrider_v1(
  p_token_hash text,
  p_payload jsonb,
  p_completed_sections text[] default '{}'::text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
  v_outrider public.community_outrider_sessions%rowtype;
  v_has_admin_fields boolean;
  v_count integer;
  v_admins jsonb := '[]'::jsonb;
  v_admin jsonb;
  v_name text;
  v_unit text;
  v_phone text;
  v_email text;
  v_sections text[];
begin
  perform public._outrider_service_role_only_v1();

  v_has_admin_fields :=
    p_payload ? 'initial_admin_count' or p_payload ? 'initial_admins';

  if v_has_admin_fields then
    if not (p_payload ? 'initial_admin_count')
       or p_payload -> 'initial_admin_count' = 'null'::jsonb then
      v_count := null;
    elsif jsonb_typeof(p_payload -> 'initial_admin_count') <> 'number'
       or (p_payload ->> 'initial_admin_count') !~ '^\d+$' then
      perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_PAYLOAD');
    else
      v_count := (p_payload ->> 'initial_admin_count')::integer;
    end if;

    if v_count is not null and (v_count < 0 or v_count > 25) then
      perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_PAYLOAD');
    end if;

    if p_payload ? 'initial_admins' then
      if jsonb_typeof(p_payload -> 'initial_admins') <> 'array'
         or jsonb_array_length(p_payload -> 'initial_admins') > 25 then
        perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_PAYLOAD');
      end if;

      for v_admin in select value from jsonb_array_elements(p_payload -> 'initial_admins')
      loop
        if jsonb_typeof(v_admin) <> 'object' then
          perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_PAYLOAD');
        end if;

        v_name := nullif(btrim(coalesce(v_admin ->> 'name', '')), '');
        v_unit := nullif(btrim(coalesce(v_admin ->> 'unit', '')), '');
        v_phone := nullif(btrim(coalesce(v_admin ->> 'phone', '')), '');
        v_email := nullif(lower(btrim(coalesce(v_admin ->> 'email', ''))), '');

        if coalesce(length(v_name), 0) > 180
           or coalesce(length(v_unit), 0) > 160
           or coalesce(length(v_phone), 0) > 80
           or coalesce(length(v_email), 0) > 254 then
          perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_PAYLOAD');
        end if;

        v_admins := v_admins || jsonb_build_array(jsonb_build_object(
          'name', v_name,
          'unit', v_unit,
          'phone', v_phone,
          'email', v_email
        ));
      end loop;
    end if;
  end if;

  v_result := public._save_community_outrider_without_admins_v1(
    p_token_hash,
    p_payload,
    p_completed_sections
  );

  if not v_has_admin_fields then
    return v_result;
  end if;

  select * into v_outrider
    from public.community_outrider_sessions
   where token_hash = btrim(coalesce(p_token_hash, ''))
   for update;

  v_sections := coalesce(v_outrider.completed_sections, '{}'::text[]);
  if not public._outrider_initial_admins_complete_v1(v_count, v_admins) then
    v_sections := array_remove(v_sections, 'contact');
  end if;

  update public.community_outrider_sessions
     set initial_admin_count = v_count,
         initial_admins = v_admins,
         completed_sections = v_sections,
         last_activity_at = now()
   where id = v_outrider.id
   returning * into v_outrider;

  return v_result || jsonb_build_object(
    'completed_sections', v_outrider.completed_sections,
    'progress_percent', cardinality(v_outrider.completed_sections) * 20,
    'updated_at', v_outrider.updated_at,
    'last_activity_at', v_outrider.last_activity_at
  );
end;
$function$;

create or replace function public.submit_community_outrider_v1(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_outrider public.community_outrider_sessions%rowtype;
begin
  perform public._outrider_service_role_only_v1();

  select * into v_outrider
    from public.community_outrider_sessions
   where token_hash = btrim(coalesce(p_token_hash, ''))
   for update;

  if not found then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_UNAVAILABLE', '42501');
  end if;

  if not public._outrider_initial_admins_complete_v1(
    v_outrider.initial_admin_count,
    v_outrider.initial_admins
  ) then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_INCOMPLETE', 'P0409');
  end if;

  return public._submit_community_outrider_without_admins_v1(p_token_hash);
end;
$function$;

create or replace function public.resolve_community_outrider_v1(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
  v_outrider public.community_outrider_sessions%rowtype;
begin
  perform public._outrider_service_role_only_v1();
  v_result := public._resolve_community_outrider_without_admins_v1(p_token_hash);

  if coalesce((v_result ->> 'available')::boolean, false) = false then
    return v_result;
  end if;

  select * into v_outrider
    from public.community_outrider_sessions
   where token_hash = btrim(coalesce(p_token_hash, ''));

  return jsonb_set(
    jsonb_set(
      v_result,
      '{outrider,initial_admin_count}',
      to_jsonb(v_outrider.initial_admin_count),
      true
    ),
    '{outrider,initial_admins}',
    coalesce(v_outrider.initial_admins, '[]'::jsonb),
    true
  );
end;
$function$;

revoke all on function public.save_community_outrider_v1(text, jsonb, text[])
  from public, anon, authenticated;
revoke all on function public.submit_community_outrider_v1(text)
  from public, anon, authenticated;
revoke all on function public.resolve_community_outrider_v1(text)
  from public, anon, authenticated;

grant execute on function public.save_community_outrider_v1(text, jsonb, text[])
  to service_role;
grant execute on function public.submit_community_outrider_v1(text)
  to service_role;
grant execute on function public.resolve_community_outrider_v1(text)
  to service_role;
