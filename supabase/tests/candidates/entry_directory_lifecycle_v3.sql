-- CANDIDATE ONLY: not in migration history. Install only in a disposable database.
-- The approved policy permits archival of ended relationships, never destruction
-- of operational history. Fail closed on an unknown UUID reference.
create schema if not exists entry_lifecycle_private;
revoke all on schema entry_lifecycle_private from public, anon, authenticated, service_role;

create or replace function entry_lifecycle_private.require_actor()
returns uuid language plpgsql security invoker set search_path=pg_catalog,public,pg_temp as $$
declare actor uuid := auth.uid();
begin
  if actor is null or not public.is_superadmin(actor) then
    raise exception 'Superadmin required' using errcode='42501';
  end if;
  return actor;
end $$;
revoke all on function entry_lifecycle_private.require_actor() from public,anon,authenticated,service_role;

-- Lock all public UUID-bearing tables (and storage.objects when installed) before
-- destructive work. NOWAIT avoids blocking the gate; contention fails closed.
-- This is deliberately conservative, pending realistic workload/lock testing.
create or replace function entry_lifecycle_private.lock_reference_tables()
returns void language plpgsql security invoker set search_path=pg_catalog,pg_temp as $$
declare r record;
begin
  for r in
    select distinct n.nspname,c.relname
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    join pg_attribute a on a.attrelid=c.oid
    where c.relkind in ('r','p') and a.attnum>0 and not a.attisdropped
      and ((n.nspname='public' and a.atttypid='uuid'::regtype) or (n.nspname='storage' and c.relname='objects'))
    order by n.nspname,c.relname
  loop
    execute format('lock table %I.%I in share row exclusive mode nowait',r.nspname,r.relname);
  end loop;
end $$;
revoke all on function entry_lifecycle_private.lock_reference_tables() from public,anon,authenticated,service_role;

-- Scan real UUID columns, including non-FK references. Exceptions are exact
-- table/column pairs, not whole tables; lifecycle audit is immutable.
create or replace function entry_lifecycle_private.has_reference(p_id uuid,p_skip text[])
returns boolean language plpgsql security invoker set search_path=pg_catalog,pg_temp as $$
declare r record; found_ref boolean;
begin
  for r in
    select n.nspname,c.relname,a.attname
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    join pg_attribute a on a.attrelid=c.oid
    where c.relkind in ('r','p') and a.attnum>0 and not a.attisdropped
      and a.atttypid='uuid'::regtype and (n.nspname='public' or (n.nspname='storage' and c.relname='objects'))
    order by n.nspname,c.relname,a.attname
  loop
    if (r.nspname||'.'||r.relname||'.'||r.attname) = any(p_skip) then continue; end if;
    execute format('select exists(select 1 from %I.%I where %I=$1)',r.nspname,r.relname,r.attname) into found_ref using p_id;
    if found_ref then return true; end if;
  end loop;
  return false;
end $$;
revoke all on function entry_lifecycle_private.has_reference(uuid,text[]) from public,anon,authenticated,service_role;

create or replace function entry_lifecycle_private.unit_eligible(p_community_id uuid,p_house_id uuid)
returns boolean language plpgsql security invoker set search_path=pg_catalog,public,pg_temp as $$
declare placeholder record;
begin
  if not exists(select 1 from public.houses where id=p_house_id and community_id=p_community_id) then return false; end if;
  if exists(select 1 from public.entry_unit_links where (unit_a_id=p_house_id or unit_b_id=p_house_id) and (ended_at is null or community_id<>p_community_id)) then return false; end if;
  if exists(select 1 from public.entry_unit_responsibilities where house_id=p_house_id and (ended_at is null or community_id<>p_community_id)) then return false; end if;
  -- Unregistered placeholders are not registration history; any attached
  -- submission, token, event, or review (including non-FK) is a blocker.
  for placeholder in select * from public.community_registration_units where house_id=p_house_id loop
    if placeholder.community_id<>p_community_id or placeholder.status is distinct from 'unregistered' then return false; end if;
    if entry_lifecycle_private.has_reference(placeholder.id,array['public.community_registration_units.id']) then return false; end if;
  end loop;
  -- Audit rows are retained; only the ended relationship rows themselves
  -- may be archived. Every other UUID reference blocks, even expired passes.
  return not entry_lifecycle_private.has_reference(p_house_id,array[
    'public.houses.id','public.community_registration_units.house_id',
    'public.entry_unit_links.unit_a_id','public.entry_unit_links.unit_b_id',
    'public.entry_unit_responsibilities.house_id','public.superadmin_audit_log.target_id'
  ]);
end $$;
revoke all on function entry_lifecycle_private.unit_eligible(uuid,uuid) from public,anon,authenticated,service_role;

create or replace function public.entry_directory_unit_delete_eligible_v3(p_community_id uuid,p_house_id uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
  perform entry_lifecycle_private.require_actor();
  return entry_lifecycle_private.unit_eligible(p_community_id,p_house_id);
end $$;
revoke all on function public.entry_directory_unit_delete_eligible_v3(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.entry_directory_unit_delete_eligible_v3(uuid,uuid) to authenticated;

create or replace function public.entry_directory_delete_unit_v3(p_community_id uuid,p_house_id uuid,p_confirmation text)
returns boolean language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare actor uuid; unit_label text; archived_links jsonb; archived_responsibilities jsonb; deleted_count integer;
begin
  actor:=entry_lifecycle_private.require_actor();
  if p_confirmation is distinct from 'DELETE' then raise exception 'Confirmation required' using errcode='22023'; end if;
  if current_setting('transaction_isolation') <> 'read committed' then raise exception 'Read committed required' using errcode='25001'; end if;
  perform entry_lifecycle_private.lock_reference_tables();
  select house_label into unit_label from public.houses where id=p_house_id and community_id=p_community_id for update;
  if not found or not entry_lifecycle_private.unit_eligible(p_community_id,p_house_id) then raise exception 'Unit cannot be deleted' using errcode='55000'; end if;
  -- If another table references a relationship row, do not cascade it away.
  if exists(select 1 from public.entry_unit_links l where (l.unit_a_id=p_house_id or l.unit_b_id=p_house_id) and entry_lifecycle_private.has_reference(l.id,array['public.entry_unit_links.id','public.superadmin_audit_log.target_id'])) or
     exists(select 1 from public.entry_unit_responsibilities r where r.house_id=p_house_id and entry_lifecycle_private.has_reference(r.id,array['public.entry_unit_responsibilities.id','public.superadmin_audit_log.target_id'])) then
    raise exception 'Relationship has additional history' using errcode='55000';
  end if;
  select coalesce(jsonb_agg(to_jsonb(l) order by l.id),'[]'::jsonb) into archived_links from public.entry_unit_links l where l.unit_a_id=p_house_id or l.unit_b_id=p_house_id;
  select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]'::jsonb) into archived_responsibilities from public.entry_unit_responsibilities r where r.house_id=p_house_id;
  insert into public.superadmin_audit_log(actor_user_id,action,target_type,target_id,metadata)
  values(actor,'entry.directory.unit.delete','unit',p_house_id,jsonb_build_object('community_id',p_community_id,'unit_label',unit_label,'ended_links',archived_links,'ended_responsibilities',archived_responsibilities));
  delete from public.entry_unit_links where community_id=p_community_id and (unit_a_id=p_house_id or unit_b_id=p_house_id) and ended_at is not null;
  delete from public.entry_unit_responsibilities where community_id=p_community_id and house_id=p_house_id and ended_at is not null;
  delete from public.community_registration_units where community_id=p_community_id and house_id=p_house_id and status='unregistered';
  delete from public.houses where community_id=p_community_id and id=p_house_id;
  get diagnostics deleted_count=row_count;
  if deleted_count<>1 then raise exception 'Unit deletion not completed' using errcode='55000'; end if;
  return true;
end $$;
revoke all on function public.entry_directory_delete_unit_v3(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.entry_directory_delete_unit_v3(uuid,uuid,text) to authenticated;

-- USER CANDIDATE. A separate isolated Auth/Storage rehearsal is still mandatory.
-- Only already-inactive, single-community accounts without any assignment or
-- live Auth session qualify. Never use this to remove a membership in isolation.
create or replace function entry_lifecycle_private.welcome_body(p_full_name text)
returns text language sql immutable security invoker set search_path=pg_catalog,pg_temp as $$
select 'Hola, ' || coalesce(nullif(split_part(coalesce(trim(p_full_name),''),' ',1),''),'Residente') ||
'. Bienvenido(a) a ENTRY. Tu comunidad ahora es mas segura, con tecnologia intuitiva e inteligente.' || chr(10) || chr(10) ||
'ENTRY es la primera herramienta de Minerva Technologies, creada para acercar capacidades modernas y soluciones avanzadas a la vida cotidiana de una forma simple, util y accesible.' || chr(10) || chr(10) ||
'Esperamos que disfrutes una experiencia que represente el futuro de la tecnologia: mas cercana a las personas y mas integrada en su dia a dia.' || chr(10) || chr(10) || '— Minerva Technologies'
$$;
revoke all on function entry_lifecycle_private.welcome_body(text) from public,anon,authenticated,service_role;

create or replace function entry_lifecycle_private.user_eligible(p_community_id uuid,p_user_id uuid)
returns boolean language plpgsql security invoker set search_path=pg_catalog,public,pg_temp as $$
declare profile_row record; member_row record; msg record; storage_owned boolean; storage_col record;
begin
  if p_user_id is null or p_user_id=auth.uid() then return false; end if;
  if not exists(select 1 from auth.users where id=p_user_id) then return false; end if;
  if exists(select 1 from auth.sessions where user_id=p_user_id) then return false; end if;
  select * into profile_row from public.profiles where user_id=p_user_id and community_id=p_community_id;
  if not found or profile_row.is_active is distinct from false or profile_row.house_id is not null then return false; end if;
  select * into member_row from public.community_members where user_id=p_user_id and community_id=p_community_id;
  if not found or member_row.is_active is distinct from false or member_row.role::text not in ('GUARD','RESIDENT','UNASSIGNED') then return false; end if;
  if (select count(*) from public.community_members where user_id=p_user_id)<>1 then return false; end if;
  if entry_lifecycle_private.has_reference(member_row.id,array['public.community_members.id']) then return false; end if;
  -- Verify the exact built-in, unedited, self-targeted welcome message.
  for msg in select * from public.community_messages m where p_user_id in (m.author_user_id,m.created_by,m.target_user_id,m.updated_by,m.deleted_by) loop
    if msg.community_id<>p_community_id or msg.source_type is distinct from 'community' or msg.author_label is distinct from 'ENTRY'
      or msg.title is distinct from 'Bienvenido(a) a ENTRY' or msg.body is distinct from entry_lifecycle_private.welcome_body(profile_row.full_name)
      or msg.author_user_id is distinct from p_user_id or msg.created_by is distinct from p_user_id or msg.target_user_id is distinct from p_user_id
      or msg.updated_by is not null or msg.deleted_by is not null or msg.deleted_at is not null or msg.image_path is not null or msg.image_url is not null
      or msg.published_at is distinct from msg.created_at or msg.expires_at is distinct from msg.created_at+interval '365 days'
      or msg.created_at<profile_row.created_at or msg.created_at>profile_row.created_at+interval '1 day' then return false; end if;
    -- No live queued deliveries or other recipients/readers. Unknown dependent
    -- records are not silently deleted by a cascade.
    if entry_lifecycle_private.has_reference(msg.id,array['public.community_messages.id','public.community_admin_activity_log.target_id']) then return false; end if;
    if exists(select 1 from public.community_admin_activity_log l where l.target_id=msg.id and
      (l.actor_user_id is distinct from p_user_id or l.community_id<>p_community_id or l.action_type is distinct from 'community_message_sent' or l.target_type is distinct from 'community_message')) then return false; end if;
  end loop;
  if exists(select 1 from public.community_admin_activity_log l where l.actor_user_id=p_user_id and not exists(
    select 1 from public.community_messages m where m.id=l.target_id and m.target_user_id=p_user_id
      and l.community_id=p_community_id and l.action_type='community_message_sent' and l.target_type='community_message'
  )) then return false; end if;
  -- Keep all administrative logs unchanged, except the verified welcome FK
  -- row which must be snapshotted before physical removal.
  if exists(select 1 from public.superadmin_audit_log l where l.actor_user_id=p_user_id or
    (l.target_id=p_user_id and (l.target_type is distinct from 'user' or l.action not in ('community_user.deactivate','community_user.reactivate')))) then return false; end if;
  if exists(select 1 from public.system_event_log l where p_user_id in (l.user_id,l.actor_id,l.entity_id) and not (
    coalesce(l.community_id=p_community_id,false) and (
      (l.user_id=p_user_id and l.actor_id is distinct from p_user_id and l.event_type='USER_PROFILE_SETUP' and l.module='superadmin' and l.source='superadmin')
      or (l.user_id=p_user_id and l.entity_id=p_user_id and l.actor_id is distinct from p_user_id and l.event_type in ('USER_DEACTIVATED_BY_SUPERADMIN','USER_REACTIVATED_BY_SUPERADMIN') and l.module='superadmin' and l.source='minerva_console')
      or (l.actor_id=p_user_id and l.user_id is null and l.event_type='NOTIFICATION_SENT' and l.module='notifications' and l.source='push_queue_trigger' and l.entity_type='community_message_push'
        and exists(select 1 from public.community_messages m where m.target_user_id=p_user_id and m.created_at<=l.created_at and m.created_at+interval '1 minute'>=l.created_at))
    )
  ) is not true) then return false; end if;
  -- Storage owner_id can be text in current versions; UUID scan alone is not sufficient.
  for storage_col in select a.attname from pg_attribute a where a.attrelid=to_regclass('storage.objects') and a.attnum>0 and not a.attisdropped and a.attname in ('owner','owner_id') loop
    execute format('select exists(select 1 from storage.objects where %I::text=$1::text)',storage_col.attname) into storage_owned using p_user_id;
    if storage_owned then return false; end if;
  end loop;
  return not entry_lifecycle_private.has_reference(p_user_id,array[
    'public.profiles.user_id','public.community_members.user_id',
    'public.community_messages.author_user_id','public.community_messages.created_by','public.community_messages.target_user_id',
    'public.community_admin_activity_log.actor_user_id',
    'public.superadmin_audit_log.target_id',
    'public.system_event_log.user_id','public.system_event_log.actor_id','public.system_event_log.entity_id'
  ]);
end $$;
revoke all on function entry_lifecycle_private.user_eligible(uuid,uuid) from public,anon,authenticated,service_role;

create or replace function public.entry_directory_user_delete_eligible_v3(p_community_id uuid,p_user_id uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
  perform entry_lifecycle_private.require_actor();
  return entry_lifecycle_private.user_eligible(p_community_id,p_user_id);
end $$;
revoke all on function public.entry_directory_user_delete_eligible_v3(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.entry_directory_user_delete_eligible_v3(uuid,uuid) to authenticated;

create or replace function public.entry_directory_delete_user_v3(p_community_id uuid,p_user_id uuid,p_confirmation text)
returns boolean language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare actor uuid; profile_snapshot jsonb; welcome_snapshot jsonb; activity_snapshot jsonb; deleted_count integer;
begin
  actor:=entry_lifecycle_private.require_actor();
  if p_confirmation is distinct from 'DELETE' then raise exception 'Confirmation required' using errcode='22023'; end if;
  if current_setting('transaction_isolation') <> 'read committed' then raise exception 'Read committed required' using errcode='25001'; end if;
  perform entry_lifecycle_private.lock_reference_tables();
  -- Parent lock blocks new FK-backed Auth sessions and memberships.
  perform 1 from auth.users where id=p_user_id for update;
  if not found or not entry_lifecycle_private.user_eligible(p_community_id,p_user_id) then raise exception 'Account cannot be deleted' using errcode='55000'; end if;
  select jsonb_build_object('role',role,'was_active',is_active,'created_at',created_at) into profile_snapshot from public.profiles where user_id=p_user_id and community_id=p_community_id;
  select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'created_at',m.created_at,'title',m.title,'author_label',m.author_label)),'[]'::jsonb) into welcome_snapshot from public.community_messages m where m.target_user_id=p_user_id;
  select coalesce(jsonb_agg(to_jsonb(l) order by l.id),'[]'::jsonb) into activity_snapshot from public.community_admin_activity_log l where l.actor_user_id=p_user_id;
  -- Don't erase external references to the archived activity itself.
  if exists(select 1 from public.community_admin_activity_log l where l.actor_user_id=p_user_id and entry_lifecycle_private.has_reference(l.id,array['public.community_admin_activity_log.id'])) then raise exception 'Additional activity dependency' using errcode='55000'; end if;
  insert into public.superadmin_audit_log(actor_user_id,action,target_type,target_id,metadata)
  values(actor,'entry.directory.user.delete','user',p_user_id,jsonb_build_object('community_id',p_community_id,'profile',profile_snapshot,'welcome_messages',welcome_snapshot,'welcome_activity',activity_snapshot));
  delete from public.community_admin_activity_log where actor_user_id=p_user_id and community_id=p_community_id;
  delete from public.community_messages where target_user_id=p_user_id and community_id=p_community_id;
  delete from public.community_members where user_id=p_user_id and community_id=p_community_id;
  delete from public.profiles where user_id=p_user_id and community_id=p_community_id;
  -- Auth deletion is transactional in the fixture, but full GoTrue/Storage
  -- behavior and old-JWT rejection must be certified before shipping.
  delete from auth.users where id=p_user_id;
  get diagnostics deleted_count=row_count;
  if deleted_count<>1 then raise exception 'Auth deletion not completed' using errcode='55000'; end if;
  return true;
end $$;
revoke all on function public.entry_directory_delete_user_v3(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.entry_directory_delete_user_v3(uuid,uuid,text) to authenticated;
