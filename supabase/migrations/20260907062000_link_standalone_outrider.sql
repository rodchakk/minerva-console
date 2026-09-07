-- Link a pre-ENTRY Outrider to the real community once ENTRY setup begins.
-- This only associates the dossier; it does not import operational records.

alter table public.community_outrider_events
  drop constraint if exists community_outrider_events_type_check;

alter table public.community_outrider_events
  add constraint community_outrider_events_type_check
  check (event_type in (
    'outrider_started',
    'outrider_saved',
    'file_uploaded',
    'outrider_submitted',
    'information_requested',
    'outrider_approved',
    'link_rotated',
    'community_linked'
  ));

create or replace function public.link_community_outrider_v1(
  p_outrider_id uuid,
  p_community_id uuid,
  p_actor_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_outrider public.community_outrider_sessions%rowtype;
  v_community public.communities%rowtype;
begin
  perform public._outrider_service_role_only_v1();

  if p_actor_user_id is null
     or not exists (select 1 from auth.users where id = p_actor_user_id) then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_ACTOR', '42501');
  end if;

  select * into v_outrider
    from public.community_outrider_sessions
   where id = p_outrider_id
   for update;

  if not found then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_UNAVAILABLE');
  end if;

  if v_outrider.community_id is not null then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_ALREADY_LINKED', 'P0409');
  end if;

  select * into v_community
    from public.communities
   where id = p_community_id;

  if not found then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_COMMUNITY');
  end if;

  if exists (
    select 1
      from public.community_outrider_sessions other
     where other.community_id = p_community_id
       and other.id <> p_outrider_id
  ) then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_CONFLICT', 'P0409');
  end if;

  update public.community_outrider_sessions
     set community_id = v_community.id,
         community_name = v_community.name,
         community_city = v_community.city,
         last_activity_at = now()
   where id = v_outrider.id
   returning * into v_outrider;

  insert into public.community_outrider_events (
    outrider_id,
    community_id,
    event_type,
    actor_type,
    actor_user_id,
    metadata
  )
  values (
    v_outrider.id,
    v_outrider.community_id,
    'community_linked',
    'entry_admin',
    p_actor_user_id,
    jsonb_build_object(
      'community_name', v_outrider.community_name,
      'community_id', v_outrider.community_id
    )
  );

  return jsonb_build_object(
    'accepted', true,
    'outrider_id', v_outrider.id,
    'community_id', v_outrider.community_id,
    'community_name', v_outrider.community_name
  );
end;
$function$;

revoke all on function public.link_community_outrider_v1(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.link_community_outrider_v1(uuid, uuid, uuid)
  to service_role;

comment on function public.link_community_outrider_v1(uuid, uuid, uuid) is
  'ENTRY internal RPC. Links an existing standalone Outrider dossier to an ENTRY community without importing operational records. service_role only.';
