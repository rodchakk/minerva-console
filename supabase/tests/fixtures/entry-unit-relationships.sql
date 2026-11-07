\set ON_ERROR_STOP on
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end $$;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table public.communities(id uuid primary key default gen_random_uuid());
create table public.community_settings(community_id uuid primary key references communities(id));
create table public.houses(id uuid primary key default gen_random_uuid(), community_id uuid not null references communities(id), house_label text not null, unique(id,community_id), unique(community_id,house_label));
create table public.community_members(id uuid primary key default gen_random_uuid(), community_id uuid not null references communities(id), user_id uuid not null references auth.users(id), unique(community_id,user_id));
create table public.resident_activation_queue(community_id uuid, house_id uuid, status text, unit_label text);
create table public.community_registration_units(community_id uuid, house_id uuid, status text, campaign_id uuid);
create table public.community_registration_campaigns(id uuid primary key, status text);
create table public.superadmin_audit_log(id uuid primary key default gen_random_uuid(), actor_user_id uuid, action text, target_type text, target_id uuid, metadata jsonb, created_at timestamptz default now());
create table public.superadmin_users(user_id uuid primary key, is_active boolean not null);
create function public.is_superadmin(p_user_id uuid default null) returns boolean language sql stable security definer set search_path=public,pg_temp as $$ select exists(select 1 from superadmin_users where user_id=coalesce(p_user_id,auth.uid()) and is_active) $$;
create function public.normalize_unit_label(text) returns text language sql immutable as $$ select regexp_replace(lower($1),'[^a-z0-9]','','g') $$;
create function public._cr_normalize_unit_label_v1(text) returns text language sql immutable as $$ select regexp_replace(lower($1),'[^a-z0-9]','','g') $$;
\ir /tmp/migration.sql
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
select 'entry-unit-relationships fixture PASS';
