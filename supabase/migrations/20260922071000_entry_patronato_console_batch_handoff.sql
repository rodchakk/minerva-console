-- ENTRY Patronato internal batch workflow.
-- Makes Minerva Console bulk transitions atomic by delegating each unit to the
-- already-hardened single-unit RPCs inside one database transaction.

create or replace function public.mark_community_registration_units_reviewed_v2(
  p_community_id uuid,
  p_campaign_unit_ids uuid[],
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_ids uuid[];
  v_id uuid;
  v_unit public.community_registration_units%rowtype;
  v_count integer := 0;
  v_result jsonb;
begin
  perform public._cr_service_role_only_v1();
  perform public._cr_validate_actor_v1(p_actor_user_id);

  if p_actor_user_id is null or p_community_id is null then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_ACTOR', '42501');
  end if;

  select array_agg(id order by id)
    into v_ids
    from (
      select distinct unnest(coalesce(p_campaign_unit_ids, '{}'::uuid[])) as id
    ) deduped
   where id is not null;

  if coalesce(array_length(v_ids, 1), 0) = 0
     or array_length(v_ids, 1) > 100 then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_UNIT', 'P0409');
  end if;

  -- Validate the entire batch before mutating any unit.
  foreach v_id in array v_ids loop
    select u.*
      into v_unit
      from public.community_registration_units u
     where u.id = v_id
       and u.community_id = p_community_id
       and exists (
         select 1
           from public.community_registration_campaigns c
          where c.id = u.campaign_id
            and c.status in ('open', 'review')
       );

    if not found or v_unit.status <> 'submitted' then
      perform public._cr_raise_v1('ENTRY_CR_REVIEW_NOT_READY', 'P0409');
    end if;
  end loop;

  foreach v_id in array v_ids loop
    v_result := public.mark_community_registration_unit_reviewed_v1(
      v_id,
      p_actor_user_id
    );
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object(
    'reviewed_count', v_count,
    'status', 'reviewed'
  );
end;
$function$;

create or replace function public.convert_community_registration_units_to_activation_v2(
  p_community_id uuid,
  p_campaign_unit_ids uuid[],
  p_actor_user_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_ids uuid[];
  v_id uuid;
  v_unit public.community_registration_units%rowtype;
  v_result jsonb;
  v_processed integer := 0;
  v_blocked integer := 0;
  v_results jsonb := '[]'::jsonb;
begin
  perform public._cr_service_role_only_v1();
  perform public._cr_validate_actor_v1(p_actor_user_id);

  if p_actor_user_id is null or p_community_id is null then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_ACTOR', '42501');
  end if;

  select array_agg(id order by id)
    into v_ids
    from (
      select distinct unnest(coalesce(p_campaign_unit_ids, '{}'::uuid[])) as id
    ) deduped
   where id is not null;

  if coalesce(array_length(v_ids, 1), 0) = 0
     or array_length(v_ids, 1) > 100 then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_UNIT', 'P0409');
  end if;

  -- Validate the full batch before converting any unit.
  foreach v_id in array v_ids loop
    select *
      into v_unit
      from public.community_registration_units
     where id = v_id
       and community_id = p_community_id;

    if not found or v_unit.status <> 'confirmed' then
      perform public._cr_raise_v1('ENTRY_CR_CONVERSION_NOT_READY', 'P0409');
    end if;
  end loop;

  foreach v_id in array v_ids loop
    v_result := public.convert_community_registration_unit_to_activation_v1(
      v_id,
      p_actor_user_id,
      p_reason
    );

    if coalesce(v_result->>'status', '') = 'blocked' then
      v_blocked := v_blocked + 1;
    else
      v_processed := v_processed + 1;
    end if;

    v_results := v_results || jsonb_build_array(
      jsonb_build_object(
        'campaign_unit_id', v_id,
        'status', v_result->>'status',
        'blocking_count', coalesce((v_result->>'blocking_count')::integer, 0)
      )
    );
  end loop;

  return jsonb_build_object(
    'processed_count', v_processed,
    'blocked_count', v_blocked,
    'results', v_results
  );
end;
$function$;

revoke execute on function public.mark_community_registration_units_reviewed_v2(uuid, uuid[], uuid)
  from public, anon, authenticated;
grant execute on function public.mark_community_registration_units_reviewed_v2(uuid, uuid[], uuid)
  to service_role;

revoke execute on function public.convert_community_registration_units_to_activation_v2(uuid, uuid[], uuid, text)
  from public, anon, authenticated;
grant execute on function public.convert_community_registration_units_to_activation_v2(uuid, uuid[], uuid, text)
  to service_role;

comment on function public.mark_community_registration_units_reviewed_v2(uuid, uuid[], uuid) is
  'Atomic Minerva Console batch transition from Submitted to Ready for Patronato for up to 100 units. service_role only.';

comment on function public.convert_community_registration_units_to_activation_v2(uuid, uuid[], uuid, text) is
  'Atomic Minerva Console batch handoff of Patronato-approved units into Activation Queue for up to 100 units. service_role only.';
