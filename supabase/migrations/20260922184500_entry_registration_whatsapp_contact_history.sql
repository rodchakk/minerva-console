-- ENTRY Resident Registration: manual WhatsApp contact history.
--
-- Records operator-confirmed resident follow-up without claiming delivery/read
-- receipts from WhatsApp. Events are append-only and retain the issue snapshot
-- that was current when the operator marked the household as contacted.

create table if not exists public.community_registration_contact_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null,
  community_id uuid not null,
  campaign_unit_id uuid not null,
  submission_id uuid not null,
  channel text not null default 'whatsapp'
    check (channel in ('whatsapp')),
  recipient_resident_id uuid,
  recipient_position integer not null
    check (recipient_position > 0),
  recipient_name_snapshot text not null
    check (length(btrim(recipient_name_snapshot)) between 1 and 200),
  recipient_phone_snapshot text not null
    check (length(btrim(recipient_phone_snapshot)) between 8 and 32),
  issue_signature text not null
    check (length(btrim(issue_signature)) between 1 and 2000),
  issue_snapshot jsonb not null
    check (jsonb_typeof(issue_snapshot) = 'array'),
  contacted_by uuid references auth.users(id) on delete set null,
  contacted_by_email_snapshot text,
  contacted_at timestamptz not null default now(),

  constraint cr_contact_events_campaign_fk
    foreign key (campaign_id)
    references public.community_registration_campaigns(id)
    on delete restrict,

  constraint cr_contact_events_community_fk
    foreign key (community_id)
    references public.communities(id)
    on delete restrict,

  constraint cr_contact_events_unit_campaign_fk
    foreign key (campaign_unit_id, campaign_id)
    references public.community_registration_units(id, campaign_id)
    on delete restrict,

  constraint cr_contact_events_submission_scope_fk
    foreign key (submission_id, campaign_unit_id, campaign_id)
    references public.community_registration_submissions(id, campaign_unit_id, campaign_id)
    on delete restrict,

  constraint cr_contact_events_resident_fk
    foreign key (recipient_resident_id)
    references public.community_registration_residents(id)
    on delete set null
);

create index if not exists idx_cr_contact_events_unit_contacted
  on public.community_registration_contact_events (
    campaign_unit_id,
    contacted_at desc
  );

create index if not exists idx_cr_contact_events_campaign_contacted
  on public.community_registration_contact_events (
    campaign_id,
    contacted_at desc
  );

create index if not exists idx_cr_contact_events_issue_signature
  on public.community_registration_contact_events (
    campaign_unit_id,
    issue_signature
  );

alter table public.community_registration_contact_events enable row level security;

revoke all on table public.community_registration_contact_events from public;
revoke all on table public.community_registration_contact_events from anon;
revoke all on table public.community_registration_contact_events from authenticated;
grant select, insert on table public.community_registration_contact_events to service_role;

create or replace function public.record_community_registration_whatsapp_contact_v1(
  p_actor_user_id uuid,
  p_campaign_unit_id uuid,
  p_recipient_position integer,
  p_issue_signature text,
  p_issue_snapshot jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_unit public.community_registration_units%rowtype;
  v_submission public.community_registration_submissions%rowtype;
  v_resident public.community_registration_residents%rowtype;
  v_contact_id uuid;
  v_actor_email text;
  v_phone_digits text;
begin
  perform public._cr_service_role_only_v1();
  perform public._cr_validate_actor_v1(p_actor_user_id);

  if p_actor_user_id is null
     or p_campaign_unit_id is null
     or p_recipient_position is null
     or p_recipient_position <= 0
     or nullif(btrim(coalesce(p_issue_signature, '')), '') is null
     or length(p_issue_signature) > 2000
     or p_issue_snapshot is null
     or jsonb_typeof(p_issue_snapshot) <> 'array'
     or jsonb_array_length(p_issue_snapshot) = 0
     or jsonb_array_length(p_issue_snapshot) > 50 then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_CONTACT_EVENT');
  end if;

  select *
    into v_unit
    from public.community_registration_units
   where id = p_campaign_unit_id
   for update;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_UNIT');
  end if;

  if v_unit.status in ('unregistered', 'merged') then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_REVIEW_STATE', 'P0409');
  end if;

  select *
    into v_submission
    from public.community_registration_submissions s
   where s.campaign_unit_id = v_unit.id
     and s.campaign_id = v_unit.campaign_id
     and s.status in ('submitted', 'edit_enabled', 'reviewed', 'confirmed', 'converted')
   order by s.version_number desc
   limit 1;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_REVIEW_STATE', 'P0409');
  end if;

  select *
    into v_resident
    from public.community_registration_residents r
   where r.submission_id = v_submission.id
     and r.campaign_unit_id = v_unit.id
     and r.position = p_recipient_position
   limit 1;

  if not found or nullif(btrim(coalesce(v_resident.phone, '')), '') is null then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_RESIDENT');
  end if;

  v_phone_digits := regexp_replace(v_resident.phone, '\D+', '', 'g');

  if length(v_phone_digits) = 8 then
    v_phone_digits := '504' || v_phone_digits;
  elsif left(v_phone_digits, 2) = '00' then
    v_phone_digits := substring(v_phone_digits from 3);
  end if;

  if length(v_phone_digits) < 8 or length(v_phone_digits) > 15 then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_RESIDENT');
  end if;

  select email
    into v_actor_email
    from auth.users
   where id = p_actor_user_id;

  insert into public.community_registration_contact_events (
    campaign_id,
    community_id,
    campaign_unit_id,
    submission_id,
    channel,
    recipient_resident_id,
    recipient_position,
    recipient_name_snapshot,
    recipient_phone_snapshot,
    issue_signature,
    issue_snapshot,
    contacted_by,
    contacted_by_email_snapshot
  )
  values (
    v_unit.campaign_id,
    v_unit.community_id,
    v_unit.id,
    v_submission.id,
    'whatsapp',
    v_resident.id,
    v_resident.position,
    v_resident.full_name,
    v_phone_digits,
    btrim(p_issue_signature),
    p_issue_snapshot,
    p_actor_user_id,
    v_actor_email
  )
  returning id into v_contact_id;

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
    v_unit.campaign_id,
    v_unit.id,
    v_submission.id,
    'internal_correction',
    'entry_admin',
    p_actor_user_id,
    jsonb_build_object(
      'action', 'whatsapp_contacted',
      'contact_event_id', v_contact_id,
      'channel', 'whatsapp',
      'recipient_resident_id', v_resident.id,
      'recipient_position', v_resident.position,
      'issue_signature', btrim(p_issue_signature)
    )
  );

  return jsonb_build_object(
    'status', 'contacted',
    'contact_event_id', v_contact_id,
    'contacted_at', now(),
    'recipient_name', v_resident.full_name,
    'recipient_phone', v_phone_digits,
    'issue_signature', btrim(p_issue_signature)
  );
end;
$function$;

revoke all on function public.record_community_registration_whatsapp_contact_v1(
  uuid, uuid, integer, text, jsonb
) from public;
revoke all on function public.record_community_registration_whatsapp_contact_v1(
  uuid, uuid, integer, text, jsonb
) from anon;
revoke all on function public.record_community_registration_whatsapp_contact_v1(
  uuid, uuid, integer, text, jsonb
) from authenticated;
grant execute on function public.record_community_registration_whatsapp_contact_v1(
  uuid, uuid, integer, text, jsonb
) to service_role;

comment on table public.community_registration_contact_events is
  'Append-only operator-confirmed resident follow-up history for Community Registration. Does not represent WhatsApp delivery or read receipts.';

comment on function public.record_community_registration_whatsapp_contact_v1(
  uuid, uuid, integer, text, jsonb
) is
  'Records a superadmin-confirmed WhatsApp resident follow-up against the current Resident Registration submission and recipient.';
