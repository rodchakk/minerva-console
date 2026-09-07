-- ENTRY-OUTRIDER-001: explicit completion path for optional source files.

create or replace function public.complete_community_outrider_available_information_v1(
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
  v_changed boolean := false;
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

  v_completed_sections := coalesce(v_outrider.completed_sections, '{}'::text[]);

  if not ('available_information' = any(v_completed_sections)) then
    v_completed_sections := array_append(v_completed_sections, 'available_information');
    v_changed := true;
  end if;

  update public.community_outrider_sessions
     set status = case
           when status = 'not_started' then 'in_progress'
           else status
         end,
         completed_sections = v_completed_sections,
         last_activity_at = now()
   where id = v_outrider.id
   returning * into v_outrider;

  if v_changed then
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
      'outrider_saved',
      'public_token',
      jsonb_build_object(
        'completed_sections', cardinality(v_completed_sections),
        'section', 'available_information',
        'without_files', true
      )
    );
  end if;

  return jsonb_build_object(
    'accepted', true,
    'status', v_outrider.status,
    'completed_sections', v_outrider.completed_sections,
    'progress_percent', cardinality(v_outrider.completed_sections) * 20,
    'updated_at', v_outrider.updated_at
  );
end;
$function$;

revoke all on function public.complete_community_outrider_available_information_v1(text)
  from public, anon, authenticated;
grant execute on function public.complete_community_outrider_available_information_v1(text)
  to service_role;
