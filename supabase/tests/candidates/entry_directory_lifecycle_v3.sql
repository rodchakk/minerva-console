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
