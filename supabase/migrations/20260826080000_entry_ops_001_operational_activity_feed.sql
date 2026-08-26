-- ENTRY-OPS-001: Curated operational activity feed for Minerva Console.
-- The feed intentionally exposes only human-readable operational summaries.
-- Raw metadata, message bodies, contact data, tokens, and internal identifiers are
-- not returned to the console read model.

create or replace function public.list_entry_operational_activity_v1(
  p_limit integer default 15
)
returns table (
  event_id text,
  occurred_at timestamptz,
  community_id uuid,
  community_name text,
  event_key text,
  event_label text,
  detail text,
  actor text,
  severity text,
  category text,
  source text
)
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
begin
  if not public.is_superadmin() then
    raise exception 'Superadmin access required' using errcode = '42501';
  end if;

  return query
  with operational_events as (
    select
      'sa:' || a.id::text as event_id,
      a.created_at as occurred_at,
      c.id as community_id,
      c.name as community_name,
      case a.action
        when 'create_community' then 'community_created'
        when 'bulk_create_houses_v2_normalized' then 'units_imported'
        when 'bulk_create_houses' then 'units_imported'
        when 'bulk_create_community_facilities' then 'facilities_configured'
        when 'generate_resident_activation_pins' then 'residents_prepared'
        when 'community.deactivate' then 'community_deactivated'
        when 'community.reactivate' then 'community_reactivated'
        when 'community_user.deactivate' then 'user_deactivated'
        when 'community_user.reactivate' then 'user_reactivated'
        else a.action
      end as event_key,
      case a.action
        when 'create_community' then 'Community created'
        when 'bulk_create_houses_v2_normalized' then 'Units imported'
        when 'bulk_create_houses' then 'Units imported'
        when 'bulk_create_community_facilities' then 'Facilities configured'
        when 'generate_resident_activation_pins' then 'Residents prepared'
        when 'community.deactivate' then 'Community deactivated'
        when 'community.reactivate' then 'Community reactivated'
        when 'community_user.deactivate' then 'User deactivated'
        when 'community_user.reactivate' then 'User reactivated'
        else 'Operational update'
      end as event_label,
      case a.action
        when 'create_community' then 'Community initialized for onboarding'
        when 'bulk_create_houses_v2_normalized' then
          case
            when a.metadata->>'inserted_count' = '1' then '1 unit imported'
            when a.metadata ? 'inserted_count' then (a.metadata->>'inserted_count') || ' units imported'
            else 'Community units imported'
          end
        when 'bulk_create_houses' then
          case
            when a.metadata->>'inserted_count' = '1' then '1 unit imported'
            when a.metadata ? 'inserted_count' then (a.metadata->>'inserted_count') || ' units imported'
            else 'Community units imported'
          end
        when 'bulk_create_community_facilities' then
          case
            when a.metadata->>'inserted_count' = '1' then '1 reservable area configured'
            when a.metadata ? 'inserted_count' then (a.metadata->>'inserted_count') || ' reservable areas configured'
            else 'Reservable areas configured'
          end
        when 'generate_resident_activation_pins' then
          case
            when a.metadata->>'generated_count' = '1' then '1 activation PIN generated'
            when a.metadata ? 'generated_count' then (a.metadata->>'generated_count') || ' activation PINs generated'
            else 'Residents prepared for activation'
          end
        when 'community.deactivate' then 'Community operations were deactivated'
        when 'community.reactivate' then 'Community operations were reactivated'
        when 'community_user.deactivate' then 'A community user was deactivated'
        when 'community_user.reactivate' then 'A community user was reactivated'
        else 'Operational update recorded'
      end as detail,
      'Minerva'::text as actor,
      case
        when a.action in ('community.deactivate', 'community_user.deactivate') then 'warning'
        else 'info'
      end as severity,
      case
        when a.action = 'generate_resident_activation_pins' then 'activation'
        when a.action like 'community_user.%' then 'admin'
        else 'setup'
      end as category,
      'superadmin_audit'::text as source
    from public.superadmin_audit_log a
    left join public.communities c
      on c.id::text = coalesce(
        nullif(a.metadata->>'community_id', ''),
        case when a.target_type = 'community' then a.target_id::text end
      )
    where a.action in (
      'create_community',
      'bulk_create_houses_v2_normalized',
      'bulk_create_houses',
      'bulk_create_community_facilities',
      'generate_resident_activation_pins',
      'community.deactivate',
      'community.reactivate',
      'community_user.deactivate',
      'community_user.reactivate'
    )

    union all

    select
      'ca:' || l.id::text,
      l.created_at,
      c.id,
      c.name,
      case l.action_type
        when 'community_message_sent' then 'message_published'
        when 'onboarding_activation_queue_reviewed' then 'activation_queue_reviewed'
        when 'onboarding_completed' then 'onboarding_completed'
        else l.action_type
      end,
      case l.action_type
        when 'community_message_sent' then 'Message published'
        when 'onboarding_activation_queue_reviewed' then 'Activation queue reviewed'
        when 'onboarding_completed' then 'Onboarding completed'
        else 'Admin activity'
      end,
      case l.action_type
        when 'community_message_sent' then 'Community update published'
        when 'onboarding_activation_queue_reviewed' then 'Prepared residents were reviewed for activation'
        when 'onboarding_completed' then 'Community setup completed and is ready for operations'
        else l.summary
      end,
      case upper(coalesce(l.actor_role, ''))
        when 'SUPERADMIN' then 'Minerva'
        when 'ADMIN' then 'Admin'
        else 'System'
      end,
      'info'::text,
      case l.action_type
        when 'community_message_sent' then 'messages'
        when 'onboarding_activation_queue_reviewed' then 'activation'
        else 'setup'
      end,
      'community_admin_activity'::text
    from public.community_admin_activity_log l
    join public.communities c on c.id = l.community_id
    where
      l.action_type in ('onboarding_activation_queue_reviewed', 'onboarding_completed')
      or (
        l.action_type = 'community_message_sent'
        and upper(coalesce(l.actor_role, '')) in ('ADMIN', 'SUPERADMIN')
      )

    union all

    select
      'msg:' || m.id::text,
      m.published_at,
      c.id,
      c.name,
      'message_published'::text,
      'Message published'::text,
      'Minerva community update published'::text,
      'Minerva'::text,
      'info'::text,
      'messages'::text,
      'community_messages'::text
    from public.community_messages m
    join public.communities c on c.id = m.community_id
    where
      m.source_type = 'system'
      and m.author_label = 'ENTRY'
      and m.target_user_id is null
      and m.deleted_at is null

    union all

    select
      'cr:' || e.id::text,
      e.created_at,
      c.id,
      c.name,
      e.event_type,
      case e.event_type
        when 'household_submitted' then 'Registration submitted'
        when 'household_resubmitted' then 'Registration resubmitted'
        when 'correction_requested' then 'Correction requested'
        when 'unit_reviewed' then 'Registration reviewed'
        when 'unit_confirmed' then 'Registration confirmed'
        when 'unit_conversion_completed' then 'Residents prepared'
        when 'resident_conversion_blocked' then 'Activation blocked'
        else 'Registration update'
      end,
      case e.event_type
        when 'household_submitted' then coalesce(u.unit_label_snapshot, 'Unit') || ' submitted for review'
        when 'household_resubmitted' then coalesce(u.unit_label_snapshot, 'Unit') || ' resubmitted after correction'
        when 'correction_requested' then coalesce(u.unit_label_snapshot, 'Unit') || ' returned for correction'
        when 'unit_reviewed' then coalesce(u.unit_label_snapshot, 'Unit') || ' reviewed by Minerva'
        when 'unit_confirmed' then coalesce(u.unit_label_snapshot, 'Unit') || ' confirmed for activation'
        when 'unit_conversion_completed' then coalesce(u.unit_label_snapshot, 'Unit') || ' moved to the activation queue'
        when 'resident_conversion_blocked' then coalesce(u.unit_label_snapshot, 'Unit') || ' could not be prepared for activation'
        else 'Registration activity recorded'
      end,
      case e.actor_type
        when 'resident_token' then 'Resident'
        when 'entry_admin' then 'Minerva'
        when 'service_role' then 'System'
        else 'System'
      end,
      case when e.event_type = 'resident_conversion_blocked' then 'warning' else 'info' end,
      case
        when e.event_type in ('unit_conversion_completed', 'resident_conversion_blocked') then 'activation'
        else 'registration'
      end,
      'community_registration'::text
    from public.community_registration_events e
    join public.community_registration_campaigns camp on camp.id = e.campaign_id
    join public.communities c on c.id = camp.community_id
    left join public.community_registration_units u on u.id = e.campaign_unit_id
    where e.event_type in (
      'household_submitted',
      'household_resubmitted',
      'correction_requested',
      'unit_reviewed',
      'unit_confirmed',
      'unit_conversion_completed',
      'resident_conversion_blocked'
    )

    union all

    select
      'sys:' || s.id::text,
      s.created_at,
      c.id,
      c.name,
      s.event_type,
      case s.event_type
        when 'SOS_PUSH_NO_GUARD_TOKENS' then 'Emergency delivery warning'
        when 'PUSH_CLAIM_RPC_ERROR' then 'Message delivery error'
        else 'Operational issue'
      end,
      case s.event_type
        when 'SOS_PUSH_NO_GUARD_TOKENS' then 'No active guard devices were available for an SOS alert'
        when 'PUSH_CLAIM_RPC_ERROR' then 'Push delivery worker could not claim pending messages'
        else 'An operational issue requires attention'
      end,
      'System'::text,
      case when upper(coalesce(s.severity, '')) = 'ERROR' then 'error' else 'warning' end,
      'system'::text,
      'system_event_log'::text
    from public.system_event_log s
    left join public.communities c on c.id = s.community_id
    where s.event_type in ('SOS_PUSH_NO_GUARD_TOKENS', 'PUSH_CLAIM_RPC_ERROR')
  )
  select
    oe.event_id,
    oe.occurred_at,
    oe.community_id,
    oe.community_name,
    oe.event_key,
    oe.event_label,
    oe.detail,
    oe.actor,
    oe.severity,
    oe.category,
    oe.source
  from operational_events oe
  order by oe.occurred_at desc, oe.event_id desc
  limit greatest(1, least(coalesce(p_limit, 15), 50));
end;
$function$;

comment on function public.list_entry_operational_activity_v1(integer) is
  'ENTRY-OPS-001 curated superadmin operational feed. Returns sanitized summaries only.';

revoke all on function public.list_entry_operational_activity_v1(integer) from public;
revoke all on function public.list_entry_operational_activity_v1(integer) from anon;
grant execute on function public.list_entry_operational_activity_v1(integer) to authenticated;
grant execute on function public.list_entry_operational_activity_v1(integer) to service_role;

-- Tighten the older community-scoped activity RPC while preserving authenticated
-- ADMIN/SUPERADMIN access enforced inside that function.
revoke execute on function public.list_community_admin_activity(uuid, integer, integer) from public;
revoke execute on function public.list_community_admin_activity(uuid, integer, integer) from anon;
grant execute on function public.list_community_admin_activity(uuid, integer, integer) to authenticated;
grant execute on function public.list_community_admin_activity(uuid, integer, integer) to service_role;
