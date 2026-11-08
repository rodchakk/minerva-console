\set ON_ERROR_STOP on
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end $$;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
create table public.communities(id uuid primary key default gen_random_uuid());
create table public.community_settings(community_id uuid primary key references communities(id));
create table public.houses(id uuid primary key default gen_random_uuid(), community_id uuid not null references communities(id), house_label text not null, owner_name text, unique(id,community_id), unique(community_id,house_label));
create table public.community_members(id uuid primary key default gen_random_uuid(), community_id uuid not null references communities(id), user_id uuid not null references auth.users(id), unique(community_id,user_id));
create table public.resident_activation_queue(community_id uuid, house_id uuid, status text, unit_label text);
create table public.community_registration_units(community_id uuid, house_id uuid, status text, campaign_id uuid);
create table public.community_registration_campaigns(id uuid primary key, status text);
create table public.superadmin_audit_log(id uuid primary key default gen_random_uuid(), actor_user_id uuid, action text, target_type text, target_id uuid, metadata jsonb, created_at timestamptz default now());
create table public.superadmin_users(user_id uuid primary key, is_active boolean not null);
create function public.is_superadmin(p_user_id uuid default null) returns boolean language sql stable security definer set search_path=public,pg_temp as $$ select exists(select 1 from superadmin_users where user_id=coalesce(p_user_id,auth.uid()) and is_active) $$;
create function public.normalize_unit_label(text) returns text language sql immutable as $$ select regexp_replace(lower($1),'[^a-z0-9]','','g') $$;
create function public._cr_normalize_unit_label_v1(text) returns text language sql immutable as $$ select regexp_replace(lower($1),'[^a-z0-9]','','g') $$;
-- Test doubles preserve the legacy write behavior and signatures. The MVP
-- migration must protect them without replacing or revoking them.
create function public.admin_update_house_label(p_house_id uuid, p_house_label text)
returns table(id uuid, community_id uuid, house_label text)
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not public.is_superadmin() then raise exception 'Unauthorized' using errcode='42501'; end if;
  return query update public.houses h set house_label=btrim(p_house_label) where h.id=p_house_id returning h.id,h.community_id,h.house_label;
end $$;
create function public.admin_update_house_profile(p_house_id uuid, p_house_label text, p_owner_name text default null)
returns table(id uuid, community_id uuid, house_label text, owner_name text)
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not public.is_superadmin() then raise exception 'Unauthorized' using errcode='42501'; end if;
  return query update public.houses h set house_label=btrim(p_house_label),owner_name=p_owner_name where h.id=p_house_id returning h.id,h.community_id,h.house_label,h.owner_name;
end $$;
\ir /tmp/migration.sql
grant usage on schema public,auth to authenticated;
grant select on public.community_settings,public.entry_unit_links,public.entry_unit_responsibilities,public.superadmin_audit_log to authenticated;
grant select,update on public.houses to authenticated;
grant usage on schema public,auth to service_role;
grant select,update on public.houses to service_role;
grant execute on function public.admin_update_house_label(uuid,text),public.admin_update_house_profile(uuid,text,text) to authenticated;
insert into auth.users values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');
insert into public.superadmin_users values ('00000000-0000-0000-0000-000000000001',true),('00000000-0000-0000-0000-000000000002',false);
insert into public.communities values ('10000000-0000-0000-0000-000000000001'),('10000000-0000-0000-0000-000000000002');
insert into public.community_settings(community_id,allow_unit_relationships) values ('10000000-0000-0000-0000-000000000001',true),('10000000-0000-0000-0000-000000000002',true);
insert into public.houses(id,community_id,house_label) values
('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','House A'),
('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Unit B'),
('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','Unit C'),
('20000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000002','Other community');
insert into public.community_members(community_id,user_id) values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
-- Only the authenticated superadmin can read; ordinary authenticated users cannot call the write RPC.
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
do $$ begin
  if (select count(*) from public.entry_unit_links) <> 0 then raise exception 'non-superadmin read allowed'; end if;
  begin perform public.manage_entry_unit_relationship_v1('link_units','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002'); raise exception 'non-superadmin write allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
-- Pending activation blocks every real label-writing route. The combined
-- profile update must roll back its owner change too.
insert into public.resident_activation_queue(community_id,house_id,status,unit_label) values
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','pending','House A');
set role authenticated;
do $$ begin
  begin perform public.admin_update_house_label('20000000-0000-0000-0000-000000000001','Blocked legacy'); raise exception 'legacy label bypassed pending activation'; exception when sqlstate '55000' then null; end;
  begin perform public.admin_update_house_profile('20000000-0000-0000-0000-000000000001','Blocked profile','Changed owner'); raise exception 'legacy profile bypassed pending activation'; exception when sqlstate '55000' then null; end;
  begin update public.houses set house_label='Blocked direct' where id='20000000-0000-0000-0000-000000000001'; raise exception 'direct update bypassed pending activation'; exception when sqlstate '55000' then null; end;
end $$;
reset role;
do $$ begin if (select owner_name from public.houses where id='20000000-0000-0000-0000-000000000001') is not null then raise exception 'blocked profile update changed owner'; end if; end $$;
select set_config('request.jwt.claim.sub','',false);
select set_config('request.jwt.claims','{"role":"service_role"}',false);
set role service_role;
do $$ begin
  begin update public.houses set house_label='Blocked service' where id='20000000-0000-0000-0000-000000000001'; raise exception 'service role bypassed pending activation'; exception when sqlstate '55000' then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
delete from public.resident_activation_queue;

-- An open registration campaign is protected through the same three routes.
insert into public.community_registration_campaigns(id,status) values ('30000000-0000-0000-0000-000000000001','open');
insert into public.community_registration_units(community_id,house_id,status,campaign_id) values
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','unregistered','30000000-0000-0000-0000-000000000001');
set role authenticated;
do $$ begin
  begin perform public.admin_update_house_label('20000000-0000-0000-0000-000000000001','Blocked legacy'); raise exception 'legacy label bypassed open campaign'; exception when sqlstate '55000' then null; end;
  begin perform public.admin_update_house_profile('20000000-0000-0000-0000-000000000001','Blocked profile','Changed owner'); raise exception 'legacy profile bypassed open campaign'; exception when sqlstate '55000' then null; end;
  begin update public.houses set house_label='Blocked direct' where id='20000000-0000-0000-0000-000000000001'; raise exception 'direct update bypassed open campaign'; exception when sqlstate '55000' then null; end;
end $$;
reset role;
update public.community_registration_campaigns set status='closed' where id='30000000-0000-0000-0000-000000000001';

-- Normalized conflicts apply to inherited routes too.
set role authenticated;
do $$ begin
  begin update public.houses set house_label=' house-a ' where id='20000000-0000-0000-0000-000000000002'; raise exception 'normalized conflict bypassed'; exception when unique_violation then null; end;
end $$;
reset role;

-- One audit row per effective rename, including the new RPC. A no-op update
-- must not produce an audit row.
set role authenticated;
do $$
declare v_count bigint;
begin
  select count(*) into v_count from public.superadmin_audit_log where action='entry.unit_label.rename';
  perform public.admin_update_house_label('20000000-0000-0000-0000-000000000003','Unit C legacy');
  if (select count(*) from public.superadmin_audit_log where action='entry.unit_label.rename') <> v_count+1 then raise exception 'legacy label audit count'; end if;
  v_count := v_count+1;
  perform public.admin_update_house_profile('20000000-0000-0000-0000-000000000003','Unit C profile','Owner');
  if (select count(*) from public.superadmin_audit_log where action='entry.unit_label.rename') <> v_count+1 then raise exception 'legacy profile audit count'; end if;
  v_count := v_count+1;
  update public.houses set house_label='Unit C direct' where id='20000000-0000-0000-0000-000000000003';
  if (select count(*) from public.superadmin_audit_log where action='entry.unit_label.rename') <> v_count+1 then raise exception 'direct audit count'; end if;
  v_count := v_count+1;
  update public.houses set house_label='Unit C direct' where id='20000000-0000-0000-0000-000000000003';
  if (select count(*) from public.superadmin_audit_log where action='entry.unit_label.rename') <> v_count then raise exception 'no-op audit count'; end if;
  perform public.manage_entry_unit_relationship_v1('rename_unit','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003',null,null,null,null,'Unit C RPC','Unit C direct');
  if (select count(*) from public.superadmin_audit_log where action='entry.unit_label.rename') <> v_count+1 then raise exception 'RPC audit duplicated'; end if;
end $$;
reset role;
-- System writes retain a NULL user actor and record their actual execution
-- context instead of inventing an auth.users identity.
select set_config('request.jwt.claim.sub','',false);
select set_config('request.jwt.claims','{"role":"service_role"}',false);
set role service_role;
update public.houses set house_label='Unit C service' where id='20000000-0000-0000-0000-000000000003';
reset role;
do $$ begin
  if not exists (
    select 1 from public.superadmin_audit_log
     where action='entry.unit_label.rename'
       and target_id='20000000-0000-0000-0000-000000000003'
       and actor_user_id is null
       and metadata->>'actor_kind'='system'
       and metadata->>'actor_role'='service_role'
       and metadata->>'new_label'='Unit C service'
  ) then raise exception 'service role audit context missing'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select set_config('request.jwt.claims','{"role":"authenticated"}',false);
select public.manage_entry_unit_relationship_v1('link_units','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001');
select public.manage_entry_unit_relationship_v1('link_units','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002');
do $$ begin
  if (select count(*) from public.entry_unit_links where ended_at is null) <> 1 then raise exception 'reverse link duplicated'; end if;
  begin perform public.manage_entry_unit_relationship_v1('link_units','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001'); raise exception 'self-link accepted'; exception when sqlstate '22023' then null; end;
  begin perform public.manage_entry_unit_relationship_v1('link_units','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000004'); raise exception 'cross-community link accepted'; exception when foreign_key_violation then null; end;
end $$;
select public.manage_entry_unit_relationship_v1('assign_responsible','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002',null,'00000000-0000-0000-0000-000000000002');
select public.manage_entry_unit_relationship_v1('assign_responsible','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003',null,'00000000-0000-0000-0000-000000000002');
do $$ begin
 if (select count(*) from public.entry_unit_responsibilities where ended_at is null) <> 2 then raise exception 'multi-unit responsibility failed'; end if;
 begin perform public.manage_entry_unit_relationship_v1('assign_responsible','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002',null,'00000000-0000-0000-0000-000000000001'); raise exception 'missing membership accepted'; exception when foreign_key_violation then null; end;
end $$;
select public.manage_entry_unit_relationship_v1('unlink_units','10000000-0000-0000-0000-000000000001',null,null,null,(select id from public.entry_unit_links where ended_at is null));
select public.manage_entry_unit_relationship_v1('link_units','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002');
do $$ begin if (select count(*) from public.entry_unit_links) <> 2 then raise exception 'relink history missing'; end if; end $$;
select public.manage_entry_unit_relationship_v1('rename_unit','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002',null,null,null,null,'Unit B Renamed','Unit B');
do $$ begin
 if (select count(*) from public.entry_unit_links where ended_at is null) <> 1 then raise exception 'rename altered relationship'; end if;
 if (select count(*) from public.superadmin_audit_log where action like 'entry.%') < 5 then raise exception 'audit missing'; end if;
end $$;
-- Historical rows intentionally block physical deletion. Operational removal
-- remains deactivation/end-dating, so no cascade may erase relationship history.
do $$ begin
  begin delete from public.houses where id='20000000-0000-0000-0000-000000000001'; raise exception 'related unit delete allowed'; exception when foreign_key_violation then null; end;
  begin delete from public.community_members where community_id='10000000-0000-0000-0000-000000000001' and user_id='00000000-0000-0000-0000-000000000002'; raise exception 'responsible membership delete allowed'; exception when foreign_key_violation then null; end;
  begin delete from public.communities where id='10000000-0000-0000-0000-000000000001'; raise exception 'related community delete allowed'; exception when foreign_key_violation then null; end;
  begin delete from auth.users where id='00000000-0000-0000-0000-000000000001'; raise exception 'relationship actor delete allowed'; exception when foreign_key_violation then null; end;
end $$;
select 'entry-unit-relationships fixture PASS';
