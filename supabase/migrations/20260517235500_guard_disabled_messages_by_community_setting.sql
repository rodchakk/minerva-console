-- Enforce the allow_messages community flag at the database boundary so
-- message feeds and writes are disabled without relying on the mobile client.

create or replace function public.list_community_messages(
  p_community_id uuid,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table(
  id uuid,
  community_id uuid,
  source_type text,
  author_label text,
  title text,
  body text,
  image_url text,
  image_path text,
  published_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  is_read boolean,
  read_at timestamptz
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with feature_gate as (
    select coalesce(cs.allow_messages, true) as allow_messages
    from public.community_settings cs
    where cs.community_id = p_community_id
  ),
  my_membership as (
    select cm.created_at
    from public.community_members cm
    where cm.community_id = p_community_id
      and cm.user_id = auth.uid()
      and cm.is_active = true
    limit 1
  )
  select
    m.id,
    m.community_id,
    m.source_type,
    m.author_label,
    m.title,
    m.body,
    m.image_url,
    m.image_path,
    m.published_at,
    m.expires_at,
    m.created_at,
    m.updated_at,
    (r.id is not null) as is_read,
    r.read_at
  from feature_gate fg
  join my_membership mm on fg.allow_messages = true
  join public.community_messages m
    on m.community_id = p_community_id
  left join public.community_message_reads r
    on r.message_id = m.id
   and r.user_id = auth.uid()
  where m.is_active = true
    and m.deleted_at is null
    and m.expires_at > now()
    and public.is_active_member_of_community(m.community_id, auth.uid())
    and m.published_at >= mm.created_at
    and (
      m.target_user_id is null
      or m.target_user_id = auth.uid()
    )
  order by m.published_at desc
  limit greatest(coalesce(p_limit, 20), 1)
  offset greatest(coalesce(p_offset, 0), 0);
$function$;

create or replace function public.guard_community_messages_by_setting()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_allow_messages boolean;
begin
  if coalesce(new.is_active, true) = false then
    return new;
  end if;

  select cs.allow_messages
  into v_allow_messages
  from public.community_settings cs
  where cs.community_id = new.community_id;

  if coalesce(v_allow_messages, true) = false then
    raise exception 'Messages are disabled for community %', new.community_id
      using errcode = '23514';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_guard_community_messages_by_setting
on public.community_messages;

create trigger trg_guard_community_messages_by_setting
before insert or update on public.community_messages
for each row
execute function public.guard_community_messages_by_setting();

create or replace function public.guard_community_message_push_queue_by_setting()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_allow_messages boolean;
begin
  select cs.allow_messages
  into v_allow_messages
  from public.community_settings cs
  where cs.community_id = new.community_id;

  if coalesce(v_allow_messages, true) = false then
    raise exception 'Messages are disabled for community %', new.community_id
      using errcode = '23514';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_guard_community_message_push_queue_by_setting
on public.community_message_push_queue;

create trigger trg_guard_community_message_push_queue_by_setting
before insert or update on public.community_message_push_queue
for each row
execute function public.guard_community_message_push_queue_by_setting();

drop policy if exists community_messages_feature_enabled_select
on public.community_messages;

create policy community_messages_feature_enabled_select
on public.community_messages
as restrictive
for select
to authenticated
using (
  is_superadmin()
  or coalesce((
    select cs.allow_messages
    from public.community_settings cs
    where cs.community_id = community_messages.community_id
  ), true)
);

drop policy if exists community_messages_feature_enabled_insert
on public.community_messages;

create policy community_messages_feature_enabled_insert
on public.community_messages
as restrictive
for insert
to authenticated
with check (
  is_superadmin()
  or coalesce((
    select cs.allow_messages
    from public.community_settings cs
    where cs.community_id = community_messages.community_id
  ), true)
);

drop policy if exists community_messages_feature_enabled_update
on public.community_messages;

create policy community_messages_feature_enabled_update
on public.community_messages
as restrictive
for update
to authenticated
using (
  is_superadmin()
  or coalesce((
    select cs.allow_messages
    from public.community_settings cs
    where cs.community_id = community_messages.community_id
  ), true)
)
with check (
  is_superadmin()
  or coalesce((
    select cs.allow_messages
    from public.community_settings cs
    where cs.community_id = community_messages.community_id
  ), true)
  or coalesce(community_messages.is_active, false) = false
);

drop policy if exists community_message_reads_feature_enabled_insert
on public.community_message_reads;

create policy community_message_reads_feature_enabled_insert
on public.community_message_reads
as restrictive
for insert
to authenticated
with check (
  exists (
    select 1
    from public.community_messages m
    join public.community_settings cs
      on cs.community_id = m.community_id
    where m.id = community_message_reads.message_id
      and coalesce(cs.allow_messages, true) = true
  )
);
