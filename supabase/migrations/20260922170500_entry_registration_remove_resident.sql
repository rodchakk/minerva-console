-- ENTRY Resident Registration: remove a resident from an active Submitted household.
--
-- The active resident row is removed so downstream review/Patronato/Activation
-- surfaces no longer see it, but a complete immutable archive copy is preserved
-- in the private schema and an internal_correction event records the action.
--
-- Safety:
-- - superadmin + service_role only
-- - only current Submitted households/submissions
-- - cannot remove the last resident
-- - cannot remove any resident already linked to Activation Queue
-- - positions are compacted after removal

create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;
grant usage on schema private to service_role;

create table if not exists private.community_registration_removed_residents (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null,
  community_id uuid not null,
  campaign_unit_id uuid not null,
  submission_id uuid not null,
  resident_id uuid not null,
  removed_at timestamptz not null default now(),
  removed_by uuid not null,
  removal_reason text,
  resident_snapshot jsonb not null,
  unique (campaign_id, resident_id)
);

revoke all on table private.community_registration_removed_residents from public;
revoke all on table private.community_registration_removed_residents from anon;
revoke all on table private.community_registration_removed_residents from authenticated;
grant select, insert on table private.community_registration_removed_residents to service_role;

create or replace function public.remove_community_registration_resident_v1(
  p_actor_user_id uuid,
  p_campaign_unit_id uuid,
  p_submission_id uuid,
  p_resident_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'private'
as $function$
declare
  v_unit public.community_registration_units%rowtype;
  v_submission public.community_registration_submissions%rowtype;
  v_resident public.community_registration_residents%rowtype;
  v_latest_submission_id uuid;
  v_resident_count integer := 0;
  v_remaining_count integer := 0;
  v_archive_id uuid;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_primary_name text;
begin
  perform public._cr_service_role_only_v1();
  perform public._cr_validate_actor_v1(p_actor_user_id);

  if p_actor_user_id is null
     or p_campaign_unit_id is null
     or p_submission_id is null
     or p_resident_id is null then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_RESIDENT');
  end if;

  if v_reason is not null and length(v_reason) > 500 then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_RESIDENT');
  end if;

  select * into v_unit
    from public.community_registration_units
   where id = p_campaign_unit_id
   for update;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_UNIT');
  end if;

  if v_unit.status <> 'submitted' then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_REVIEW_STATE', 'P0409');
  end if;

  select s.id into v_latest_submission_id
    from public.community_registration_submissions s
   where s.campaign_unit_id = v_unit.id
     and s.status in ('submitted', 'edit_enabled', 'reviewed', 'confirmed', 'converted')
   order by s.version_number desc
   limit 1;

  if v_latest_submission_id is distinct from p_submission_id then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_REVIEW_STATE', 'P0409');
  end if;

  select * into v_submission
    from public.community_registration_submissions
   where id = p_submission_id
     and campaign_unit_id = v_unit.id
   for update;

  if not found or v_submission.status <> 'submitted' then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_REVIEW_STATE', 'P0409');
  end if;

  select * into v_resident
    from public.community_registration_residents
   where id = p_resident_id
     and submission_id = v_submission.id
     and campaign_unit_id = v_unit.id
   for update;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_RESIDENT');
  end if;

  select count(*)::integer
    into v_resident_count
    from public.community_registration_residents r
   where r.submission_id = v_submission.id
     and r.campaign_unit_id = v_unit.id;

  if v_resident_count <= 1 then
    perform public._cr_raise_v1(
      'ENTRY_CR_RESIDENT_REMOVAL_LAST_RESIDENT',
      'P0409'
    );
  end if;

  if v_resident.activation_queue_id is not null
     or exists (
       select 1
         from public.resident_activation_queue q
        where q.community_registration_resident_id = v_resident.id
     ) then
    perform public._cr_raise_v1(
      'ENTRY_CR_RESIDENT_REMOVAL_ACTIVATION_LINKED',
      'P0409'
    );
  end if;

  insert into private.community_registration_removed_residents (
    campaign_id,
    community_id,
    campaign_unit_id,
    submission_id,
    resident_id,
    removed_by,
    removal_reason,
    resident_snapshot
  )
  values (
    v_submission.campaign_id,
    v_submission.community_id,
    v_unit.id,
    v_submission.id,
    v_resident.id,
    p_actor_user_id,
    v_reason,
    to_jsonb(v_resident)
  )
  returning id into v_archive_id;

  insert into public.community_registration_events (
    campaign_id,
    campaign_unit_id,
    submission_id,
    event_type,
    actor_type,
    actor_user_id,
    metadata
  )
  values (
    v_submission.campaign_id,
    v_unit.id,
    v_submission.id,
    'internal_correction',
    'entry_admin',
    p_actor_user_id,
    jsonb_build_object(
      'action', 'resident_removed',
      'archive_id', v_archive_id,
      'resident_id', v_resident.id,
      'resident_name', v_resident.full_name,
      'resident_position', v_resident.position,
      'reason', v_reason,
      'unit_status_preserved', v_unit.status,
      'submission_status_preserved', v_submission.status
    )
  );

  delete from public.community_registration_residents
   where id = v_resident.id
     and submission_id = v_submission.id
     and campaign_unit_id = v_unit.id;

  -- Shift positions out of the way first to avoid the unique
  -- (submission_id, position) index while compacting the list.
  update public.community_registration_residents
     set position = position + 1000
   where submission_id = v_submission.id
     and campaign_unit_id = v_unit.id;

  with ordered as (
    select id,
           row_number() over (order by position, id)::integer as new_position
      from public.community_registration_residents
     where submission_id = v_submission.id
       and campaign_unit_id = v_unit.id
  )
  update public.community_registration_residents r
     set position = ordered.new_position
    from ordered
   where r.id = ordered.id;

  select count(*)::integer,
         max(full_name) filter (where position = 1)
    into v_remaining_count, v_primary_name
    from public.community_registration_residents
   where submission_id = v_submission.id
     and campaign_unit_id = v_unit.id;

  return jsonb_build_object(
    'status', 'removed',
    'archive_id', v_archive_id,
    'removed_resident_id', v_resident.id,
    'removed_resident_name', v_resident.full_name,
    'removed_position', v_resident.position,
    'remaining_resident_count', v_remaining_count,
    'primary_resident_name', v_primary_name,
    'unit_status', v_unit.status,
    'submission_status', v_submission.status
  );
end;
$function$;

revoke all on function public.remove_community_registration_resident_v1(uuid, uuid, uuid, uuid, text) from public;
revoke all on function public.remove_community_registration_resident_v1(uuid, uuid, uuid, uuid, text) from anon;
revoke all on function public.remove_community_registration_resident_v1(uuid, uuid, uuid, uuid, text) from authenticated;
grant execute on function public.remove_community_registration_resident_v1(uuid, uuid, uuid, uuid, text) to service_role;

comment on function public.remove_community_registration_resident_v1(uuid, uuid, uuid, uuid, text) is
  'Removes one resident from the current Submitted Resident Registration household while preserving an immutable private archive copy and audit event.';
